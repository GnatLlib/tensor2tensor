import unittest
from selenium_helper import SeleniumHelper


class TestInsightLoad(unittest.TestCase):

    def test_load_homepage(self):
        SeleniumHelperInstance.initializeWebdriver("Chrome")
        SeleniumHelperInstance.navigateToHome()

        SeleniumHelperInstance.waitForPageTitle("NMT Research Frontend")
        SeleniumHelperInstance.closeBrowser()


if __name__ == '__main__':
    SeleniumHelperInstance = SeleniumHelper()
    unittest.main()