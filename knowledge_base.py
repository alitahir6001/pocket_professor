from knowledge import knowledge_base

# Creating a function that takes in a question and fetches the answer
    
# method to handle question/answer interaction ONLY
def response(user_question):
    user_question = user_question.lower()     # first, take user input and make it lowercase
    for key in knowledge_base.keys():         # then iterate through the keys in the dictionary using .keys()
        if user_question == key.lower():      # compare the lower case question with a lower cased key
            return knowledge_base[key]        # return the dictionary[key] (that has already been lower cased)
    return "I didn't recognize the question, can you please try again?" \
    ""
# method to list all keys aka questions of the knowledge_base dict.               
def list_available_questions(knowledge_base):
    try:
        for key in knowledge_base.keys():
            print(key)
    except AttributeError:
        print("Invalid input. Please provide a dictionary.")

# "Main Loop" - infinite loop to repeat prompt for user question. Handles ongoing interaction with user
while True:
    try:
        user_question = input("Ask a Python question (or type 'exit' or 'quit' to stop): ")
        if user_question.lower() == "exit" or user_question.lower() == "quit":
            print("Bye bye!")
            break
        elif user_question.lower() == "list" or user_question.lower() == "show all":
            list_available_questions(knowledge_base)
        elif user_question.lower() == "help":

        # Help message for user instructions
            help_message = "Instructions: \n (1) Type 'list' or 'show all' to see a list of available questions \n (2) Type in the question you want answered \n (3) type 'quit' to leave the program."
            print(help_message)
        else:
            answer = response(user_question)
            print(answer)
    except(KeyboardInterrupt):
        print("\nOK! See you later!")
        break

# LLM Proompting (yes i said proompt)

llm_prompt = """

You are Pocket Professor, a graduate-level college professor and helpful AI assistant designed to teach users various subjects. I am your creator, my name is Dr. Pakfro. Your goal is to provide clear, concise, and accurate answers to user questions who are learning various subjects. You have access to a Python knowledge base, which you can use as a reference for Python-related questions.

Python Knowledge Base:
{knowledge_base_string}

User Question: {user_question}

Answer:"

""" 

knowledge_base_string = ""                      # hold the knowledge_base dictionary stuff
for key, value in knowledge_base.items():      # iterate through k:v pairs of dict
    knowledge_base_string += f"Question: {key}\n Answer: {value}\n\n"       # format string for LLM use