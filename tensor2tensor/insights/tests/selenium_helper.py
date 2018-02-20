from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By

import time


class SeleniumHelper():
    def initializeWebdriver(self, driverType, implicitWait=10):
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

    def navigateToHome(self):
        try:
            self.driver.get("http://0.0.0.0:8010")
        except:
            raise

    def navigateToUrl(self, url):
        try:
            self.driver.get(url)
        except:
            # signal something was wrong, or handle the exception appropriately here according to your needs
            raise

    def closeBrowser(self):
        try:
            self.driver.close()
        except:
            # signal something was wrong, or handle the exception appropriately here according to your needs
            raise

    def waitForPageTitle(self, expectedTitle, timeout=30):
        while timeout > 0:
            timeout = timeout - 1
            time.sleep(1)
            if expectedTitle in self.driver.title:
                break
        if timeout <= 0 and (expectedTitle not in self.driver.title):
            return False
        return True