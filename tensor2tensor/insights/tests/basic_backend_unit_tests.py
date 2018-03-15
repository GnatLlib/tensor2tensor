import unittest
from tensor2tensor.insights.query_processor import QueryProcessor
from tensor2tensor.insights.transformer_model import TransformerModel


class BaseBackendTest(unittest.TestCase):
  def setUp(self):
    self.tf = TransformerModel(
      {u'transformer': {u'hparams_set': u'transformer_base_single_gpu',
                        u'data_dir': u'/Users/billtang/t2t_data',
                        u'problems': u'translate_ende_wmt32k',
                        u'hparams': u'',
                        u'model_dir': u'/Users/billtang/t2t_train/base',
                        u'model': u'transformer'},
                        u'source_language': u'en',
                        u'label': u'transformers_wmt32k',
                        u'target_language': u'de'})
    self.hookdir = "tensors"


class TestGraphVis(BaseBackendTest):

  def runTest(self):

    print(TransformerModel.__dict__)
    result = TransformerModel.get_graph_vis(self.tf, self.hookdir)
    print(result)

    self.assertEquals(result, result)

class TestProcessingVis(BaseBackendTest):

  def runTest(self):

    result = self.tf.get_processing_vis("test input string", [10,20,30,40,50])

    print(result)

    self.assertEquals(result,result)

if __name__ == '__main__':
    unittest.main()