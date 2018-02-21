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

"""Module for postprocessing and displaying tranformer attentions.
This module is designed to be called from an ipython notebook.
"""

import json
import os

import numpy as np


class Attention():

    def get_full_attention(layer):
        """Get the full input+output - input+output attentions."""
        enc_att = enc_atts[layer][0]
        dec_att = dec_atts[layer][0]
        encdec_att = encdec_atts[layer][0]
        enc_att = np.transpose(enc_att, [0, 2, 1])
        dec_att = np.transpose(dec_att, [0, 2, 1])
        encdec_att = np.transpose(encdec_att, [0, 2, 1])
        # [heads, query_length, memory_length]
        enc_length = enc_att.shape[1]
        dec_length = dec_att.shape[1]
        num_heads = enc_att.shape[0]
        first = np.concatenate([enc_att, encdec_att], axis=2)
        second = np.concatenate(
            [np.zeros((num_heads, dec_length, enc_length)), dec_att], axis=2)
        full_att = np.concatenate([first, second], axis=1)
        return [ha.T.tolist() for ha in full_att]
    def get_inp_inp_attention(layer):
        att = np.transpose(enc_atts[layer][0], (0, 2, 1))
        return [ha.T.tolist() for ha in att]

    def get_out_inp_attention(layer):
        att = np.transpose(encdec_atts[layer][0], (0, 2, 1))
        return [ha.T.tolist() for ha in att]

    def get_out_out_attention(layer):
        att = np.transpose(dec_atts[layer][0], (0, 2, 1))
        return [ha.T.tolist() for ha in att]

    def get_attentions(get_attention_fn):
        num_layers = len(enc_atts)
        attentions = []
        for i in range(num_layers):
          attentions.append(get_attention_fn(i))

        return attentions
