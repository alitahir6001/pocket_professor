from modules.llm_interaction import query_llm
import app

def generate_syllabus(subject, difficulty, time, goal):
    """
    This function handles the syllabus generation using input taken from the user in app.py:
        1. get inputs --> (1) subject (2) difficulty (3) time committment (4) goal if they have one
        2. create prompt --> comprehensive system prompt to generate learning path/syllabus.
        3. LLM -->   call via Ollama to display the generated learning path, error out if not.
    """
    
