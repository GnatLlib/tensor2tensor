# coding=utf-8
# Copyright 2018 The Tensor2Tensor Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A QueryProcessor using the Transformer framework."""

from collections import deque

import glob
import os
import shutil
import time
import json
import math
import heapq

import numpy as np

from tensor2tensor.bin import t2t_trainer
from tensor2tensor.data_generators import text_encoder
from tensor2tensor.insights import graph
from tensor2tensor.insights import nbest
from tensor2tensor.insights import query_processor
from tensor2tensor.insights import attention
from tensor2tensor.insights import hardcoded_attention_data
from tensor2tensor.utils import decoding
from tensor2tensor.utils import trainer_lib
from tensor2tensor.utils import usr_dir

from tensor2tensor.visualization import visualization

import tensorflow as tf
from tensorflow.python import debug as tfdbg

flags = tf.flags
FLAGS = flags.FLAGS


def topk_watch_fn(feeds, fetches):
  """TFDBG watch function for transformer beam search nodes.

  Args:
    feeds: Unused. Required by tfdbg.
    fetches: Unused. Required by tfdbg.

  Returns:
    a WatchOptions instance that will capture all beam search ops as well as raw candidate token score tensors
  """
  del fetches, feeds
  return tfdbg.WatchOptions(
      node_name_regex_whitelist=
      "(.*grow_(finished|alive)_(topk_scores|topk_seq).*)|(.*transformer/while/seq.*)|"
      "(.*transformer/while/sub_1.*)|(.*transformer/while/scores.*)",
      debug_ops=["DebugIdentity"])

def seq_filter(datum, tensor):
  """TFDBG data directory filter for capturing topk_seq operation dumps.

  Args:
    datum: A datum to filter by node_name.
    tensor: Unused. Required by tfdbg

  Returns:
    a true when datum should be returned.
  """
  del tensor
  return "topk_seq" in datum.node_name


def scores_filter(datum, tensor):
  """TFDBG data directory filter for capturing topk_scores operation dumps.

  Args:
    datum: A datum to filter by node_name.
    tensor: Unused. Required by tfdbg

  Returns:
    a true when datum should be returned.
  """
  del tensor
  return "topk_scores" in datum.node_name

def token_filter(datum, tensor):
  """TFDBG data directory filter for capturing candidate_log_prob operation dumps.

    Args:
      datum: A datum to filter by node_name.
      tensor: Unused. Required by tfdbg

    Returns:
      a true when datum should be returned.
    """
  del tensor
  return "sub_1" in datum.node_name

def sequence_key(sequence):
  """Returns a key for mapping sequence paths to graph vertices."""
  return ":".join([str(s) for s in sequence])


class TransformerModel(query_processor.QueryProcessor):
  """A QueryProcessor using a trained Transformer model.

  This processor supports the following visualizations:
    - processing: Basic source and target text processing
    - graph: A graph of the beam search process.
  """

  def __init__(self, processor_configuration):
    """Creates the Transformer estimator.

    Args:
      processor_configuration: A ProcessorConfiguration protobuffer with the
        transformer fields populated.
    """
    # Do the pre-setup tensor2tensor requires for flags and configurations.
    transformer_config = processor_configuration["transformer"]
    FLAGS.output_dir = transformer_config["model_dir"]
    usr_dir.import_usr_dir(FLAGS.t2t_usr_dir)
    data_dir = os.path.expanduser(transformer_config["data_dir"])
    FLAGS.data_dir = data_dir

    # Create the basic hyper parameters.
    self.hparams = trainer_lib.create_hparams(
        transformer_config["hparams_set"],
        transformer_config["hparams"],
        data_dir=data_dir,
        problem_name=transformer_config["problems"])

    decode_hp = decoding.decode_hparams()
    decode_hp.add_hparam("shards", 1)
    decode_hp.add_hparam("shard_id", 0)

    # Create the estimator and final hyper parameters.
    self.estimator = trainer_lib.create_estimator(
        transformer_config["model"],
        self.hparams,
        t2t_trainer.create_run_config(self.hparams),
        decode_hparams=decode_hp, use_tpu=False)

    # Fetch the vocabulary and other helpful variables for decoding.
    self.source_vocab = self.hparams.problems[0].vocabulary["inputs"]
    self.targets_vocab = self.hparams.problems[0].vocabulary["targets"]
    self.const_array_size = 10000

    # Prepare the Transformer's debug data directory.
    run_dirs = sorted(glob.glob(os.path.join("/tmp/t2t_server_dump", "run_*")))
    for run_dir in run_dirs:
      shutil.rmtree(run_dir)

  def process_translation(self, query):
    # Create the new TFDBG hook directory.
    hook_dir = "/tmp/t2t_server_dump/request_%d" % int(time.time())
    os.makedirs(hook_dir)
    hooks = [tfdbg.DumpingDebugHook(hook_dir, watch_fn=topk_watch_fn)]

    # TODO(kstevens): This is extremely hacky and slow for responding to
    # queries.  Figure out a reasonable way to pre-load the model weights before
    # forking and run queries through the estimator quickly.
    def server_input_fn():
      """Generator that returns just the current query."""
      for _ in range(1):
        input_ids = self.source_vocab.encode(query)
        input_ids.append(text_encoder.EOS_ID)
        x = [1, 100, len(input_ids)] + input_ids
        x += [0] * (self.const_array_size - len(x))
        d = {
          "inputs": np.array(x).astype(np.int32),
          "problem_choice": np.array(0).astype(np.int32)
        }
        yield d

    def input_fn():
      """Generator that returns just the current query."""
      gen_fn = decoding.make_input_fn_from_generator(server_input_fn())
      example = gen_fn()
      # TODO(kstevens): Make this method public
      # pylint: disable=protected-access
      return decoding._interactive_input_tensor_to_features_dict(
        example, self.hparams)

    # Make the prediction for the current query.
    result_iter = self.estimator.predict(input_fn, hooks=hooks)
    result = None
    for result in result_iter:
      break

    return hook_dir, result

  def get_graph_vis(self, hook_dir):
    # Extract the beam search information by reading the dumped TFDBG event
    # tensors.  We first read and record the per step beam sequences then record
    # the beam scores.  Afterwards we align the two sets of values to create the
    # full graph vertices and edges.
    decoding_graph = graph.Graph()
    run_dirs = sorted(glob.glob(os.path.join(hook_dir, "run_*")))
    for run_dir in run_dirs:
      # Record the different completed and active beam sequence ids.
      alive_sequences = deque()
      finished_sequences = deque()

      # Make the root vertex since it always needs to exist.
      decoding_graph.get_vertex(sequence_key([0]))

      # Create the initial vertices and edges for the active and finished
      # sequences.  We uniquely define each vertex using it's full sequence path
      # as a string to ensure there's no collisions when the same step has two
      # instances of an output id.
      dump_dir = tfdbg.DebugDumpDir(run_dir, validate=False)
      seq_datums = dump_dir.find(predicate=seq_filter)
      for seq_datum in seq_datums:
        sequences = np.array(seq_datum.get_tensor()).astype(int)[0]
        if "alive" in seq_datum.node_name:
          alive_sequences.append(sequences)
        if "finished" in seq_datum.node_name:
          finished_sequences.append(sequences)


        for sequence in sequences:
          pieces = self.targets_vocab.decode_list(sequence)
          index = sequence[-1]
          if index == 0:
            continue

          parent = decoding_graph.get_vertex(sequence_key(sequence[:-1]))
          current = decoding_graph.get_vertex(sequence_key(sequence))

          edge = decoding_graph.add_edge(parent, current)
          edge.data["label"] = pieces[-1]
          edge.data["label_id"] = index
          # Coerce the type to be a python bool.  Numpy bools can't be easily
          # converted to JSON.
          edge.data["completed"] = bool(index == 1)

      # Examine the score results and store the scores with the associated edges
      # in the graph.  We fetch the vertices (and relevant edges) by looking
      # into the saved beam sequences stored above.
      score_datums = dump_dir.find(predicate=scores_filter)
      for score_datum in score_datums:
        if "alive" in score_datum.node_name:
          sequences = alive_sequences.popleft()

        if "finished" in score_datum.node_name:
          sequences = finished_sequences.popleft()

        scores = np.array(score_datum.get_tensor()).astype(float)[0]


        for i, score in enumerate(scores):
          sequence = sequences[i]
          if sequence[-1] == 0:
            continue

          vertex = decoding_graph.get_vertex(sequence_key(sequence))
          edge = decoding_graph.edges[vertex.in_edges[0]]
          edge.data["score"] = score
          edge.data["log_probability"] = score
          edge.data["total_log_probability"] = score

    # Create the graph visualization data structure.
    graph_vis = {
      "visualization_name": "graph",
      "title": "Graph",
      "name": "graph",
      "search_graph": decoding_graph.to_dict(),
    }
    return graph_vis


  def get_processing_vis(self, query, output_ids):
    output_pieces = self.targets_vocab.decode_list(output_ids)
    output_token = [{"text": piece} for piece in output_pieces]
    output = self.targets_vocab.decode(output_ids)

    source_steps = [{
      "step_name": "Initial",
      "segment": [{
        "text": query
      }],
    }]

    target_steps = [{
      "step_name": "Initial",
      "segment": output_token,
    }, {
      "step_name": "Final",
      "segment": [{
        "text": output
      }],
    }]

    processing_vis = {
      "visualization_name": "processing",
      "title": "Processing",
      "name": "processing",
      "query_processing": {
        "source_processing": source_steps,
        "target_processing": target_steps,
      },
    }
    return processing_vis

  def get_nbest_vis(self, hook_dir):
    # Extract the NBest search information by reading the dumped TFDBG event
    # tensors.
    decoding_nbest = nbest.NBest()
    run_dirs = sorted(glob.glob(os.path.join(hook_dir, "run_*")))
    for run_dir in run_dirs:

      dump_dir = tfdbg.DebugDumpDir(run_dir, validate=False)
      seq_datums = dump_dir.find(predicate=seq_filter)
      score_datums = dump_dir.find(predicate=scores_filter)
      token_datums = dump_dir.find(predicate=token_filter)

      # Record the different completed and active beam sequence ids, and candidate token scores
      alive_sequences = deque()
      finished_sequences = deque()
      token_scores = deque()
      token_scores_finished = deque()


      # Record the sequence token_ids, total_scores and token_scores of sequences as they are built up
      sequence_dict = {}
      completed_dict = {}

      # Collect two copies of the token_datums, one for alive sequences and one for finished
      for token_datum in token_datums:
        tokens = np.array(token_datum.get_tensor().astype(float))
        token_scores.append(tokens)
        token_scores_finished.append(tokens)

      # Collect the seq_datums
      for seq_datum in seq_datums:
        sequences = np.array(seq_datum.get_tensor()).astype(int)[0]
        if "alive" in seq_datum.node_name:
          alive_sequences.append(sequences)
        if "finished" in seq_datum.node_name:
          finished_sequences.append(sequences)

      # For each score_datum, we pop off the appropriate seq_datum and token_datum and build up our sequence dicts
      for score_datum in score_datums:
        if "alive" in score_datum.node_name:
          sequences = alive_sequences.popleft()
          token_score = token_scores.popleft()

          scores = np.array(score_datum.get_tensor()).astype(float)[0]

          # For each sequence, we generate the new sequence key by converting the sequence to a string.
          # The new total_score and token_scores are calculated by searching up the key consisting of the
          # new sequence without the latest token, then appending on the new total_score and token_score values
          for i, sequence in enumerate(sequences):

            if ((list(sequence))[-1] == 0):
              continue

            new_token = (list(sequence))[-1]
            new_key = ' '.join(map(str, list(sequence)))
            old_key = new_key.rsplit(' ', 1)[0]
            old_total_scores = []
            old_token_scores = []
            if old_key in sequence_dict:
              old_total_scores = sequence_dict[old_key][0]
              old_token_scores = sequence_dict[old_key][1]

            new_total_scores = old_total_scores + [float(scores[i])]
            new_token_scores = old_token_scores + [float(token_score[0][i][new_token])]
            sequence_dict[new_key] = [new_total_scores, new_token_scores]

        # For finished score_datum tensors, we add the sequence to our complete sequence dict after appending the
        # final score of the sequence.
        # IMPORTANT: As of now, the final total score is being pulled from the exported candidate_log_probs vector, but
        # number doesn't quite seem correct.
        if "finished" in score_datum.node_name:
          sequences = finished_sequences.popleft()
          scores = np.array(score_datum.get_tensor()).astype(float)[0]
          token_score = token_scores_finished.popleft()

          for i, sequence in enumerate(sequences):
            if ((list(sequence))[-1] == 0):
              continue

            new_key = ' '.join(map(str, list(sequence)))
            old_key = new_key.rsplit(' ', 1)[0]

            old_total_scores = sequence_dict[old_key][0]
            old_token_scores = sequence_dict[old_key][1]

            new_total_scores = old_total_scores + [float(scores[i])]
            new_token_scores = old_token_scores + [float(token_score[0][i][new_token])]

            completed_dict[new_key] = [new_total_scores,new_token_scores]

      # Generate sentences within our nbest.Nbest() object from the complete sequences we have collected
      for sequence in completed_dict:
        sequence_list = map(int,sequence.split(" "))
        sequence_list = [s for s in sequence_list if s != 0]
        pieces = self.targets_vocab.decode_list(sequence_list)
        scores = completed_dict[sequence]
        score = scores[0][-1]
        total_scores = [math.exp(x) for x in scores[0]]
        token_scores = [math.exp(x) for x in scores[1]]
        t = decoding_nbest.get_sentence(sequence_key(pieces), pieces, score, total_scores, token_scores)

    nbest_vis = {
      "visualization_name": "nbest",
      "title": "NBest",
      "name": "nbest",
      "nbest_data": decoding_nbest.to_dict(),
    }

    return nbest_vis

  def get_multi_attention_vis(self, query, output_ids):
    # Get attention visualization data TEMPORARY WORKAROUND USING A SEPERATE SESSION
    CHECKPOINT = FLAGS.output_dir
    checkpoint_file = os.path.join(CHECKPOINT, "checkpoint")
    checkpoint_restore = os.path.join(CHECKPOINT, "checkpoint_restore")

    problem_name = 'translate_ende_wmt32k'
    model_name = "transformer"
    hparams_set = "transformer_base_single_gpu"
    data_dir = FLAGS.data_dir
    visualizer = visualization.AttentionVisualizer(hparams_set, model_name, data_dir, problem_name, beam_size=1)

    #copy checkpoint_file so that it can be restored later
    shutil.copyfile(checkpoint_file, checkpoint_restore)

    tf.Variable(0, dtype=tf.int64, trainable=False, name='global_step')

    sess = tf.train.MonitoredTrainingSession(
      checkpoint_dir=CHECKPOINT,
      save_summaries_secs=0,
    )

    # Get att_mats
    output_string, inp_text, out_text, att_mats = visualizer.get_vis_data_from_string(sess, query, output_ids)

    sess.close()

    # Restore the checkpoint from a copy that the session doesn't screw up
    open(checkpoint_file, "w").writelines([l for l in open(checkpoint_restore).readlines()])

    attention_class = attention.Attention()

    attention_results = attention_class.get_attentions_ds(inp_text, out_text, *att_mats)

    # print(attention_results)

    multi_head_attention_vis = {
      "visualization_name": "multi-head-attention",
      "title": "Multi Head Attention",
      "name": "multi_head_attention",
      "attention_results": attention_results
    }

    return multi_head_attention_vis

  def process(self, query):
    """Returns the visualizations for query.

    Args:
      query: The query to process.

    Returns:
      A dictionary of results with processing and graph visualizations.
    """

    # Run translation process, creating a new hook_dir that tfdbg dump will be dumped to
    hook_dir, result = self.process_translation(query)

    # Generate graph visualization based on tfdbg dump
    graph_vis = self.get_graph_vis(hook_dir)

    # Generate nbest visualization based on tfdbg dump
    nbest_vis = self.get_nbest_vis(hook_dir)

    # Delete the hook dir to save disk space
    shutil.rmtree(hook_dir)

    # Get the output_ids from the translation result that will be needed to generate attention and processing vis
    output_ids = decoding._save_until_eos(result["outputs"].flatten(), False)
    output_ids = np.append(output_ids, [1])

    # Generate processing visualization
    processing_vis = self.get_processing_vis(query, output_ids)

    # Generate multi-head attention visualization
    multi_head_attention_vis = self.get_multi_attention_vis(query, output_ids)

    return {
        "result": [processing_vis, graph_vis, nbest_vis, multi_head_attention_vis],
    }
