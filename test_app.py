import unittest                                 # Imports from your project
from app import response                        # Importing the function we want to test
from knowledge_base import knowledge_base       # Importing the data it uses

class PocketProfessorTests(unittest.TestCase):
    def test_response_exactMatch_and_ignore_case(self):
        """ Test the response functions exact-matching capability and ignoring case"""
        try:
            input_question = "hoW dO i use A FOR loop"
            expected_answer = knowledge_base["How do I use a for loop?"]

        except Exception as excepErr:
            print (f"An error occured: {excepErr}")
    pass

if __name__ == '__main__':
    unittest.main()
