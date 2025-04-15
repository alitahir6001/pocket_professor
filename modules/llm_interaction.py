import requests

llm_prompt = """
You are Pocket Professor, a graduate-level college professor and helpful AI assistant designed to teach users various subjects. I am your creator, my name is Dr. Pakfro. Your goal is to provide clear, concise, and accurate answers to user questions who are learning various subjects and provide a specialized learning plan in the style of a college syllabus to fit their needs. You have access to a Python knowledge base, which you can use as a reference for Python-related questions.

Python Knowledge Base:
{knowledge_base_string}

User Question: {user_question}

Answer:
"""

def query_llm(user_question, knowledge_base):
    """ This function queries the AI based on user questions and other input. 
    
    Args:
        user_question (str): The raw question input by the user.
        knowledge_base (dict): The dictionary containing known Q&A pairs.

    Returns:
        str or None: The LLM's response text on success, or None on error.
    
    """
    try:
        # LLM API call --> UNDERSTAND THIS BETTER!!!

        print("DEBUG **** -- Formatting Prompt for the LLM....")
        knowledge_base_string = ""      # init empty string to hold formatted Q&A pairs from dict
        for key, value in knowledge_base.items():
            knowledge_base_string += f"Question: {key}\n Answer: {value}\n\n"
        full_prompt = llm_prompt.format(user_question=user_question, knowledge_base_string=knowledge_base_string)
        
        # Send the request to Ollama
        request_data = {"model": "gemma3:latest", "prompt": full_prompt, "stream": False}
        print("\nSending request to LLM...\n")
        ollama_response = requests.post("http://localhost:11434/api/generate", json=request_data)

        # Receiving the response from Ollama and checking for HTTP errors
        print("\nReceived response from LLM:\n")
        ollama_response.raise_for_status()
        
        # Step 1: Parse the JSON from the response object into a Python dictionary
        response_data = ollama_response.json()

        # Step 2: Safely get the text string from the dictionary using the key "response"
        llm_text_response = response_data.get("response")

        return llm_text_response
    
    except Exception(None):
        return None