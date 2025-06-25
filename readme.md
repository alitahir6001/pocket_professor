<!--# The Pocket Professor by DrPakfro

## A small, AI-powered tutor app designed to be your personal college level instructor

### Pocket Professor is both a way to learn emerging tech and also combine my passions for education and technology. I am an academic at heart and I wanted to make something for my fellow autodidacts.

### Since I was about 13, anything I was interested in I explored deeply and tried to emulate by learning how to do it. I have taught myself how to play drums, taught myself how to cook, and taught myself how to code before attending the now defunct Coding Dojo bootcamp. Just to name a few things I was curious about and wanted to explore further.

### The internet is vast and varied, and while there are a plethora of learning platforms, tools, videos and docs at ones disposal, creating a learning guide/syllabus catered to ones own learning style is difficult. We have to create a hodge-podge, castaway type raft of assembled tools to learn our own way and I love the idea of a college-style syllabus that can be made to appeal to that need. So I figured why not make it myself?


#### This repo is still under development, and made public to share with co-horts and friends. A full readme is on the way i promise!!!

As of June 16th 2025:

- cleaned up app.py to remove the now un-used question/answer loop code blocks from the very first version of this app
- I moved the unused blocks over to snippets.py as an in-project repository of sorts to reference the earlier version of this project.
- With these commits, the latest main branch will then become a template for the new MVP i want to work toward, with one main feature: take user prompts of subject, difficulty level, time commitments (in hours/week), and learning goal to create a dedicated learning guide for the user, and then exit. One primary function, one main feature, and then build from there.
Godspeed, me!


TODO: create a polished "version 0.01" of the app that had the original question/answer loop, using the knowledge base dictionary, jaccard similarity algo to check for typos, and THEN calls the LLM if the user wanted to ask a question outside of the knowledge base dictionary. 

💡 Feature Idea: Consider adding a "just in time" learning feature, which only gives the syllabus/user the material they need to learn and understand for THAT lesson/week, etc. Most people try to learn too much, too early, which leads to information overload and poor retention.
  - Consider adding a section of the syllabus that applies the learning they are doing in a realistic and practical way, outside of just exercises. Real world examples would be best.
  - if there's nothing the user needs to learn urgently, only then consider broader universally acceptable concepts/ 

💡 Feature Idea: Something that helps the user take notes as they go.

💡 Feature Idea: Agent that adds "study time" to their Google Calendar for them once the syllabus and web scraping agent find the relevant material for them. 
  - Def of done: Syllabus created, agent scouts out relevant material based on that syllabus, and adds blocks of time to their calendar based on their weekly hour commitment.
  - All the user should do is wake up, get an alert on their phone it's time to start studying, and have my app show them the relevant material for the day.

💡 Feature Idea: Github API integration that creates repos with starter code (and readme) for the user if they're learning tech.

💡 Feature Idea - Market-driven gap analysis is brilliant - This is real-time competitive intelligence that no chatbot can provide. When you tell an investor "we scrape job listings and tell users what skills they're missing," that's a legitimate business model.

💡 Feature Idea: Address Motivation issue by tracking hours completed. Be like "20 hours completed = 1 college credit" or something like that. 
  - How should I address the "what should i do now?" outside of just "here is your weekly learning goal."
  - ** Motivation issues are usually tied to curricula issues. If the shit is boring, they wont want to continue. Make it not boring.

💡 Feature Idea - Add a "referesher" note that briefly explains where the user were when they left off

⭐💡 Feature Idea - Intelligent adaptation: Somehow, the app learns about the user as the user continues to learn. The more they use the app, the more it learns.
  - If user is away for multiple days, remind them of where they werre
  - Suggest easier or shorter tasks to rebuild momentum
  - "You are x% complete toward your certification/test/career goal

<!-->


# 📚 Pocket Professor

Your personal AI-powered syllabus generator for lifelong learners.

---

<p align="center">
  <img src="https://cafans.b-cdn.net/images/Category_22057/subcat_38643/Hcolor3.jpg" style="width:400px;" alt="The Pocket Professor"/>
</p>

---

### 👋 About The Project

### Pocket Professor is both a way to learn emerging tech and also combine my passions for education and technology. I am an academic at heart and I wanted to make something for my fellow autodidacts.

### Since I was about 13, anything I was interested in I explored deeply and tried to emulate by learning how to do it. I have taught myself how to play drums, taught myself how to cook, and taught myself how to code before attending the now defunct Coding Dojo bootcamp. Just to name a few things I was curious about and wanted to explore further.

### The internet is vast and varied, and while there are a plethora of learning platforms, tools, videos and docs at ones disposal, creating a learning guide/syllabus catered to ones own learning style is difficult. We have to create a hodge-podge, castaway type raft of assembled tools to learn our own way and I love the idea of a college-style syllabus that can be made to appeal to that need. So I figured why not make it myself?
This repository is currently under active development and is being shared with friends and collaborators.

### ✨ Core Features (MVP Goal)

* **Personalized Syllabus Generation:** Takes a user's subject, desired difficulty, learning goal, and time commitment.
* **Clear Learning Goals:** Creates a dedicated learning guide to help you achieve your objectives with a detailed and structured breakdown.
* **Focused Learning:** One primary function, executed well. The app generates your guide and then exits, allowing you to focus on learning.

---

### 🚀 Project Status & Roadmap

**Current Version:** `v0.0.3` (In Development)

**As of June 16th, 2025:**

* ✅ cleaned up `app.py` to remove the now un-used question/answer loop code blocks from the very first version of this app
* ✅ I moved the unused blocks over to `snippets.py` as an in-project repository of sorts to reference the earlier version of this project.
* 🏁 The `main` branch is now a template for the new MVP.

**Next Steps & To-Do List:**

* [ ] **Flesh out MVP:** Implement the core feature of generating a learning guide from user prompts.
* [ ] **Create "Version 0.04":** Re-integrate the original Q&A loop as a secondary feature.
    * [ ] Use the knowledge base module (dictionary).
    * [ ] Re-implement Jaccard similarity for typo correction.
    * [ ] Re-add LLM call for questions outside the knowledge base.
* [ ] **Add a Project Logo:** Create a simple, memorable logo for Pocket Professor.

---

<p align="center">
  Happy Learning! 🧠
</p>
