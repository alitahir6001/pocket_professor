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
        if not knowledge_base:
            print("The knowledge base is empty.")
            return

        print("Available questions:")
        for question in knowledge_base.keys():
            print(f"- {question}")
    except Exception as e:
        print(f"An error occurred while listing questions: {e}")

def response(user_question):
    try:
        if user_question in knowledge_base:
            return knowledge_base[user_question]
        else:
            return "I didn't recognize the question, can you please try again?"
    except Exception as e:
        return f"An error occurred while processing the response: {e}"

while True:
    try:
        user_question = input("Ask a question (or type 'exit' or 'quit' to stop): ")
        user_question_lower = user_question.lower()

        if user_question_lower == "exit" or user_question_lower == "quit":
            print("Bye bye!\n")
            break
        elif user_question_lower == "list" or user_question_lower == "show all":
            list_available_questions(knowledge_base)
        elif user_question_lower == "help":
            help_message = "Instructions: \n (1) Type 'list' or 'show all' to see a list of available questions \n (2) Type in the question you want answered \n (3) type 'quit' to leave the program."
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