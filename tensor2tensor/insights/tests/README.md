# Testing

This folder contains our unit and functional tests

To run backend unit tests use:
```
    python basic_backend_unit_tests.py
```
The last test, which involves running a tensorflow session to extract attention tensors from a model may take some time.

To run frontend automated UI tests, make sure the Insights server is running on 0:0:0:0:8010 and use:
```
    python basic_functional_tests.py
```
Because some of these tests involve actually querying the model and performing translations, they can take a very long time to complete.