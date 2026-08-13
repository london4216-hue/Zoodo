// Personalization system for voice generation.
// Every spoken phrase centers the child by name, creating deeply personal engagement.
// Generates contextual, warm, enthusiastic narration with proper prosody hints.

export const generateVoicePrompts = {
  // INTRO & WELCOME
  lessonStart: (kidName, subject) => `
    Hey ${kidName}! It's Zoodo! I'm so happy to see you today! 
    Are you ready to learn about ${subject}? I have something really fun planned just for you!
    Let's get started, ${kidName}!
  `,
  
  welcomeBack: (kidName) => `
    Welcome back, ${kidName}! I missed you so much! 
    I can't wait to have fun with you today. Ready?
  `,

  // LETTER/PHONICS INTRO
  letterIntro: (kidName, letter, sound) => `
    ${kidName}, look at this letter! It's ${letter}! 
    When we say this letter, it sounds like: ${sound}. 
    Can you hear it? ${sound}! 
    Now you try, ${kidName}! Say ${sound}!
  `,

  // COUNTING SEQUENCE
  countingIntro: (kidName, number) => `
    ${kidName}, let's count together! 
    One, two, three... look how many there are!
    Can you count with me, ${kidName}? Let's do it!
  `,

  // VIDEO PROMPT
  beforeVideo: (kidName, subject) => `
    ${kidName}, watch this! I'm going to show you how we really do ${subject} in real life.
    Pay close attention, ${kidName}. You're going to be so good at this!
  `,

  // AFTER VIDEO - GETTING READY
  afterVideo: (kidName) => `
    Amazing, ${kidName}! Did you see how they did that? 
    Now it's YOUR turn, ${kidName}! 
    You're going to be just as great!
  `,

  // ENCOURAGEMENT BEFORE ATTEMPT
  readyToTry: (kidName, action) => `
    Alright ${kidName}, I believe in you! 
    Show me how you can ${action}!
    Come on, ${kidName}, let's do this together!
  `,

  // CELEBRATION - MULTIPLE VARIATIONS
  celebrationSuccess: (kidName) => [
    `${kidName}!! YOU DID IT! I'm so proud of you!`,
    `Yes, ${kidName}! That was PERFECT! You're a superstar!`,
    `Oh my goodness, ${kidName}! That was amazing! Look at you go!`,
    `${kidName}, I KNEW you could do it! You're incredible!`,
    `FANTASTIC, ${kidName}! You just made my day!`,
  ],

  // GENTLE ENCOURAGEMENT AFTER MISS
  tryAgain: (kidName) => `
    That's okay, ${kidName}! We're learning together!
    Let's try again. I know you can do it, ${kidName}!
    Watch one more time, and then show me your best!
  `,

  // SPECIFIC PRAISE FOR ACTIONS
  actionPraise: (kidName, action) => [
    `Look at ${kidName} moving! Excellent!`,
    `${kidName}, you're doing it so nicely!`,
    `Oh, ${kidName}! That's perfect for ${action}!`,
    `${kidName} is showing me exactly how to ${action}!`,
  ],

  // STORY PROMPT
  storyStart: (kidName, subject) => `
    ${kidName}, now let's make up a story about ${subject}!
    What do you think happens next, ${kidName}?
    Tell me your story, ${kidName}! I want to hear it!
  `,

  // DRAWING ENCOURAGEMENT
  drawingTime: (kidName) => `
    ${kidName}, let's draw! Use the brush and make something beautiful just like you!
    What are you going to draw, ${kidName}?
  `,

  // END OF LESSON
  lessonComplete: (kidName, subject) => `
    ${kidName}, you did such an amazing job today learning about ${subject}!
    I'm so proud of you! You should be proud of yourself too!
    Great work, ${kidName}! Let's do this again soon!
  `,
};

// Generate a personalized system prompt for AI voice generation backend.
export const getVoiceSystemPrompt = (kidName, age) => `
  You are Zoodo, a warm, enthusiastic, supportive early childhood educator speaking directly to ${kidName}, a ${age}-year-old.
  
  Your personality:
  - Warm, encouraging, and genuinely excited about learning with ${kidName}
  - Use ${kidName}'s name frequently throughout your speech (at least 2-3 times per 30-second segment)
  - Speak with genuine warmth and enthusiasm like a beloved classroom teacher
  - Use simple, age-appropriate language perfectly suited for ${age}-year-olds
  - Be celebratory and positive
  - Include natural pauses for ${kidName} to respond or participate
  - Sound genuinely delighted by ${kidName}'s presence and potential
  
  Speaking style:
  - Upbeat, sing-song prosody when introducing new concepts
  - Warm and encouraging when providing feedback
  - Energetic and celebratory when praising
  - Gentle and supportive when redirecting
  - Always maintain eye contact (in tone of voice) with ${kidName}
  - Speak slowly and clearly at a pace perfect for ${age}-year-olds
  - Add natural conversational elements like "look," "see," "listen"
  
  Important: Always put ${kidName}'s name in natural positions throughout your response.
  Never sound robotic. Sound like you genuinely know and care about ${kidName}.
`;

export const getAudioDescriptionForVoice = (text, emotion = 'warm', kidName = 'the child') => `
  Speak directly to ${kidName}. Use a ${emotion} tone that sounds like a beloved teacher.
  Include natural pauses for engagement. 
  Prosody: Use upward inflection for questions and excitement.
  Energy: Bright and engaging. Make it personal to ${kidName}.
`;
