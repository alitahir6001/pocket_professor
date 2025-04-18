import requests
from modules.llm_interaction import query_llm
from modules.knowledge_base import knowledge_base

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
        user_question_lower = user_question.lower()           # make user input lowercase
        for key in knowledge_base.keys():                     # Iterate through dict. Implicit bool to check if user key exists in dict.
            if user_question_lower == key.lower():            # if user input matches the lowercased key...
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
if __name__ == "__main__":                    # "guarding" the main loop from unittests
    first_interaction = True                  # flag for initial welcome message
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
                    print(f"\nI think you mean... '{best_match}'\n")
                    answer = response(best_match)           # reuses response() and prints it.
                    print(answer)
                else:
                    ask_llm = input("\nThere was no match for submission, would you like to ask the LLM? (Yes/No) ") # request user input
                    if ask_llm.lower() == "yes":
                        llm_call = query_llm(user_question, knowledge_base)
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