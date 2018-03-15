import unittest
from selenium_helper import SeleniumHelper


class TestBasicFunctional(unittest.TestCase):

    def test_load_homepage(self):
        SeleniumHelperInstance.initialize_webdriver("Chrome")
        SeleniumHelperInstance.navigate_to_home()

        self.assertTrue(SeleniumHelperInstance.wait_for_page_title("NMT Research Frontend"))
        SeleniumHelperInstance.close_browser()

    def test_translation(self):
        SeleniumHelperInstance.initialize_webdriver("Chrome")
        SeleniumHelperInstance.navigate_to_home()
        SeleniumHelperInstance.translate("The cat is fat")

        self.assertTrue(SeleniumHelperInstance.wait_for_translation())

        self.assertTrue(SeleniumHelperInstance.select_visualization_graph("NBest"))
        SeleniumHelperInstance.close_browser()

    def test_nBest_tab(self):
        SeleniumHelperInstance.initialize_webdriver("Chrome")
        SeleniumHelperInstance.navigate_to_home()
        SeleniumHelperInstance.translate("The cat is fat")

        self.assertTrue(SeleniumHelperInstance.wait_for_translation())
        self.assertTrue(SeleniumHelperInstance.select_visualization_graph("NBest"))
        SeleniumHelperInstance.close_browser()

    def test_attention_tab(self):
        SeleniumHelperInstance.initialize_webdriver("Chrome")
        SeleniumHelperInstance.navigate_to_home()
        SeleniumHelperInstance.translate("The cat is fat")

        self.assertTrue(SeleniumHelperInstance.wait_for_translation())
        self.assertTrue(SeleniumHelperInstance.select_visualization_graph("Multi Head Attention"))
        SeleniumHelperInstance.close_browser()


if __name__ == '__main__':
    SeleniumHelperInstance = SeleniumHelper()
    unittest.main()