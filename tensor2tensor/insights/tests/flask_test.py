import os
import flaskr
import unittest
import tempfile

class FlaskrTestCase(unittest.TestCase):
    def setUp(self):
        flaskr.app.testing = True
        self.app = flaskr.app.test_client()

    def tearDown(self):
        return

    def test_api(self):
        rv = self.app.get('/api/corpussearch?query=madam', follows_redirect=False)
        assert rv is not None


if __name__ == '__main__':
    unittest.main()
