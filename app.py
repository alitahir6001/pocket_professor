import requests
from knowledge_base import knowledge_base

llm_prompt = """
You are Pocket Professor, a graduate-level college professor and helpful AI assistant designed to teach users various subjects. I am your creator, my name is Dr. Pakfro. Your goal is to provide clear, concise, and accurate answers to user questions who are learning various subjects. You have access to a Python knowledge base, which you can use as a reference for Python-related questions.

Python Knowledge Base:
{knowledge_base_string}

User Question: {user_question}

Answer:
"""

def list_available_questions(knowledge_base):
    try:
        if not knowledge_base:                               # Check if dict. is empty with "not" operator.
            print("\nThe knowledge base is empty.\n")
            return                                           # Exit w/ empty return if dictonary is empty.

        print("Available questions:")
        for question in knowledge_base.keys():
            print(f"- {question}")                           # adds hyphen when printing each question.
    except Exception as errors:
        print(f"\nAn error occurred while listing questions: {errors}\n")

def response(user_question):
    try:
        user_question_lower = user_question.lower()
        for key in knowledge_base.keys():                     # implicit bool to check if user key exists in dict.
            if user_question_lower == key.lower():            # if user input matches the key...
                return knowledge_base[key]                    # return that question key from the dict.
        else:
            return "\nI didn't recognize the question, can you please try again?\n"
    except Exception as errors:                                # catch any exceptions as "errors"
        return f"\nAn error occurred while processing the response: {errors}\n"
    

def typo_checker(user_question, know_base_keys, threshold=0.8):
    """
    Finds the closest matching question in the knowledge base to the user's input,
    using a simple character-matching similarity algorithm.

    Args:
        user_question (str): The user's question (lowercased).
        knowledge_base_keys (list): A list of the lowercased keys from the knowledge base.
        threshold (float, optional): The minimum similarity ratio to consider a match.
            Defaults to 0.8.

    Returns:
        str or None: The closest matching key from the knowledge base, or None if no
            match is found.
    """
    try:
        shared_count = 0                        # hold the shared character count
        for potential_match in know_base_keys:  # iterate thru list of keys. Remember: know_base_keys will be arg passed later in main loop.
            if potential_match == user_question:
                for char_user in potential_match:
                    if char_user in potential_match:
                        shared_count_current += 1
                # Now we have the shared_count_current for this potential_match       
                # We need to calculate the similarity ratio and compare with the threshold
                pass

    except Exception as errors:
        return f"\nThere was an error with checking the question: {errors}\n"


first_interaction = True                                       # flag for initial welcome message
while True:
    try:
        if first_interaction == True:
            user_question = input("\n Welcome to Pocket Professor! Ask a question (or type 'exit' or 'quit' to stop). Type 'help' for instructions: ")
        else: user_question = input("\nWhat's next? Submit a question or type 'help' for instructions, or 'quit' to leave: ")
        first_interaction = False                              # set flag to not display welcome msg again.
        user_question_lower = user_question.lower()

        if user_question_lower == "exit" or user_question_lower == "quit":
            print("\nBye bye!\n")
            break
        elif user_question_lower == "list" or user_question_lower == "show all":
            list_available_questions(knowledge_base)
        elif user_question_lower == "help":
            help_message = "\nInstructions: \n (1) Type 'list' or 'show all' to see a list of available questions \n (2) Type in the question you want answered \n (3) type 'quit' to leave the program."
            print(help_message)
        elif user_question_lower in [key.lower() for key in knowledge_base]:
            answer = response(user_question)
            print(answer)
        else:
            # LLM API call
            knowledge_base_string = ""
            for key, value in knowledge_base.items():
                knowledge_base_string += f"Question: {key}\n Answer: {value}\n\n"
            full_prompt = llm_prompt.format(user_question=user_question, knowledge_base_string=knowledge_base_string)
            request_data = {"model": "mistral:latest", "prompt": full_prompt}
            response = requests.post("http://localhost:11434/api/generate", json=request_data)
            response.raise_for_status()
            llm_response = response.json()["response"]
            print(llm_response)

    except KeyboardInterrupt:
        print("\nOK! See you later!\n")
        break
    except EOFError:
        print("\nEnd of input detected, so I will exit. See you later!\n")
        break
    except requests.exceptions.RequestException as reqErr:
        print(f"Error sending request to Ollama API: {reqErr}")
    except ValueError as valErr:
        print(f"Unexpected value error has occurred: {valErr}")
    except Exception as excepErr:
        print(f"Unexpected exception occurred: {excepErr}")