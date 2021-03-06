from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By

import time


class SeleniumHelper():

    def initialize_webdriver(self, driverType, implicitWait=10):
        # initialize appropriate driver, remember to download driver and add it to you PATH environment variable
        if driverType == 'Firefox':
            self.driver = webdriver.Firefox()
        elif driverType == 'Chrome':
            self.driver = webdriver.Chrome('./chromedriver')
        elif driverType == 'IE':
            self.driver = webdriver.Ie()
        else:
            raise Exception('Unknown webdriver type')
        # for every action do a retry with a 10 seconds timeout by default or user specified
        self.driver.implicitly_wait(implicitWait)

    def expand_root_element(self,element):
        ele = self.driver.execute_script("return arguments[0].shadowRoot", element)

        return ele

    def navigate_to_home(self):
        try:
            self.driver.get("http://0.0.0.0:8010")
        except:
            raise

    def navigate_to_url(self, url):
        try:
            self.driver.get(url)
        except:
            # signal something was wrong, or handle the exception appropriately here according to your needs
            raise

    def translate(self, query):
        try:
            root1 = self.driver.find_element_by_tag_name("insights-app")

            insight_app_root = self.expand_root_element(root1)

            root2 = insight_app_root.find_element_by_css_selector("explore-view")

            explore_view_root = self.expand_root_element(root2)

            root3 = explore_view_root.find_element_by_css_selector("paper-input")

            paper_input_root = self.expand_root_element(root3)

            input = paper_input_root.find_element_by_id("nativeInput")

            input.clear()

            input.send_keys(query + Keys.RETURN)

        except:
            raise

    def close_browser(self):
        try:
            self.driver.close()
        except:
            # signal something was wrong, or handle the exception appropriately here according to your needs
            raise

    def select_visualization_graph(self, visualization):

        try:
            root1 = self.driver.find_element_by_tag_name("insights-app")

            insight_app_root = self.expand_root_element(root1)

            root2 = insight_app_root.find_element_by_css_selector("explore-view")

            explore_view_root = self.expand_root_element(root2)

            root3 = explore_view_root.find_element_by_css_selector("translation-result")

            translation_result_root = self.expand_root_element(root3)

            tabs = translation_result_root.find_elements_by_css_selector("paper-tab")


            for tab in tabs:
                if tab.text ==  (visualization):
                    tab.click()

            return True
        except:
            raise

        return True

    def wait_for_page_title(self, expectedTitle, timeout=30):
        while timeout > 0:
            timeout = timeout - 1
            time.sleep(1)
            if expectedTitle in self.driver.title:
                break
        if timeout <= 0 and (expectedTitle not in self.driver.title):
            return False
        return True

    def wait_for_translation(self, timeout=300):

        while timeout > 0:
            timeout = timeout - 1
            time.sleep(1)
            try:
                root1 = self.driver.find_element_by_tag_name("insights-app")

                insight_app_root = self.expand_root_element(root1)

                root2 = insight_app_root.find_element_by_css_selector("explore-view")

                explore_view_root = self.expand_root_element(root2)

                results = explore_view_root.find_element_by_css_selector("translation-result")

                return True

            except:
                continue

        if timeout <= 0:
            return False

        return True
