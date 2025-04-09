import requests
from knowledge_base import knowledge_base

llm_prompt = """
You are Pocket Professor, a graduate-level college professor and helpful AI assistant designed to teach users various subjects. I am your creator, my name is Dr. Pakfro. Your goal is to provide clear, concise, and accurate answers to user questions who are learning various subjects and provide a specialized learning plan in the style of a college syllabus to fit their needs. You have access to a Python knowledge base, which you can use as a reference for Python-related questions.

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
    

# Similarity algorithm
def typo_checker(user_question, know_base_keys, threshold=0.8):
    """
    Goal: find key in dict. most similar to user input. Must be above a certain threshold:
        1. Init placeholder values for best match and a score for that similarity (Before the loop).
        2. Iterate through keys of dictionary. 
        3. Calculate similarity for current key being examined. Use vars to hold values (Inside the loop).
            3a. Create set() 's for each string to compare (ex: user input string vs key string)
            3b. find my_intersection = set1.intersection(set2) -- of the two sets
            3c. find my_union = set1.union(set2) -- of the two sets
            3d. calculate current ratio by dividing: my_current_ratio = length of my_intersection / my_union
        4. Use if conditional to check best match by comparing current_ratio with similarity score and the threshold it should go above.
            4a. if current_ratio > similarity_score AND current_ratio > threshold, update vars to new assignments:
                4b. similarity_score = current_ratio
                4b. best_match = potential_match
            4c. This will only execute if the check above is True. If not, nothing variable assignments will be updated.
        5. Return the best_match (Outside the loop)

    """

    try:
        best_match = None                               # init best match so far
        similarity_score = 0.0                          # init a score for this similarity.
        for potential_match in know_base_keys:          # main loop of typo_checker. Iterate thru list of keys.
            userInputSet = set(user_question)                            # create a set for each string (user, and dict. key)
            potentialSet = set(potential_match)
            matching_vals = userInputSet.intersection(potentialSet)      # collect all unique chars within both sets
            union_set = userInputSet.union(potentialSet)                 # combine all unique chars into new set
            if len(union_set) > 0:                                       # if set is not empty...

                # calculate current_ratio: length of all matching chars in user question with all matching chars of the ditionary key
                current_ratio = len(matching_vals) / len(union_set) 
            else:
                current_ratio = 0.0                     # if both strings were empty, they have no similarity to each other
                
            # ensure the current match is strictly better than the best one you found before
            if current_ratio > similarity_score and current_ratio >= threshold:     # if it is...
                similarity_score = current_ratio                                    # update the best score and, 
                best_match = potential_match                                        # update the best match
        
        # tell the function to return latest greatest best match
        return best_match

    except Exception as errors:
        return f"\nThere was an error with checking the question: {errors}\n"

# main loop

first_interaction = True                                       # flag for initial welcome message
while True:
    try:
        if first_interaction == True:
            user_question = input("\nWelcome to Pocket Professor! Ask a question (or type 'exit' or 'quit' to stop). Type 'help' for instructions: ")
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
            print("\nDEBUG: No exact match found. Checking for typos...\n") # Optional debug message

            # integrate typo_checker by calling it and passing args it needs to operate.
            best_match = typo_checker(user_question_lower, [key.lower() for key in knowledge_base.keys()])
            if best_match is not None:                  # if typo match is found
                print("\nI think you mean...\n")
                answer = response(best_match)           # reuses response() and prints it.
                print(answer)
            else:
                ask_llm = input("\nThere was no match for submission, would you like to ask the LLM? (Yes/No) ") # request user input
                if ask_llm.lower() == "yes":

                    # LLM API call --> UNDERSTAND THIS BETTER!!!

                    knowledge_base_string = ""      # init empty string to hold formatted Q&A pairs from dict
                    for key, value in knowledge_base.items():
                        knowledge_base_string += f"Question: {key}\n Answer: {value}\n\n"
                    full_prompt = llm_prompt.format(user_question=user_question, knowledge_base_string=knowledge_base_string)
                    
                    # Send the request to Ollama
                    request_data = {"model": "gemma3:latest", "prompt": full_prompt, "stream": False}
                    print("\nSending request to LLM...\n")
                    ollama_response = requests.post("http://localhost:11434/api/generate", json=request_data)

                    # Receiving the response from Ollama
                    print("\nReceived response from LLM:\n")
                    ollama_response.raise_for_status()              # Check for HTTP errors

                    llm_response = ollama_response.json()["response"] # parsed the JSON response from LLMg
                    print(llm_response)
                else:
                    print("\nOK, I wont ask the LLM!\n")

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
    except AttributeError as attErr:
        print(f"An Unexpected Attribute error occured: {attErr}")
    except Exception as excepErr:
        print(f"Unexpected exception occurred: {excepErr}")