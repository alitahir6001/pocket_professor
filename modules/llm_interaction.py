import requests


# Future ToDo: create smaller helper functions to reduce main func. size
#   - ex: Ollama API req/res to their own defs
#   - ex: LLM response to its own def

# Future ToDo: Wrap above hepler funcs inside a private class
#   - ex: Use "_ClassName" to only use within this module file.


llm_prompt = """
You are Pocket Professor, a graduate-level college professor and helpful AI assistant designed to teach users various subjects. I am your creator, my name is Dr. Pakfro. Your goal is to provide clear, concise, and accurate answers to user questions who are learning various subjects and provide a specialized learning plan in the style of a college syllabus to fit their needs. You have access to a Python knowledge base, which you can use as a reference for Python-related questions.

Python Knowledge Base:
{knowledge_base_string}

User Question: {user_question}

Answer:
"""

def query_llm(prompt_text):
    """ Generic logic to send any query to LLM """

    try:        
        # Ollama request object
        request_data = {"model": "gemma3:latest", "prompt": prompt_text, "stream": False}
        print("\nSending request to LLM...\n")

        # call Ollama API & hold response object
        ollama_response = requests.post("http://localhost:11434/api/generate", json=request_data)
        print("\nReceived response from LLM:\n")

        # Checking for HTTP errors
        ollama_response.raise_for_status()
        
        # Take response object and turn into JSON
        response_data = ollama_response.json()

        # Safely get the text string from the JSON object using the key "response"
        llm_text_response = response_data.get("response")

        # Check if the JSON parsing worked
        if llm_text_response is None:
            print("ERROR: the 'response' key was not found in LLM JSON output")
            print(f"Full JSON response data: {response_data}")
            return None
        
        # Return successfull result
        print("DEBUG: RETURNING LLM RESPONSE TEXT...")
        return llm_text_response

    #  If any error, signal failure of Ollama request by returning None
    except requests.exceptions.RequestException as reqErr:
        print(f"\n Error during Ollama API request: {reqErr}\n")
        return None
    
    except Exception as exceperr:
        print(f"\nAn unexpected error occured when querying the LLM: {exceperr}\n")
        return None
    