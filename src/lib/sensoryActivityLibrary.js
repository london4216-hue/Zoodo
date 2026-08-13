// Sensory-Based Daily Activity Add-Ons
// Optional enrichment activities that caregivers can choose to add to each day's lesson plan
// Evidence-based sensory activities for child development and regulation

export const sensoryActivityOptions = {
  // Proprioceptive (body awareness, deep pressure)
  proprioceptive: [
    {
      id: 'wall_push',
      name: 'Wall Pushes',
      age: [2, 8],
      description: 'Push against wall for body awareness',
      duration: '2-5 min',
      instructions: 'Stand facing wall. Push hard for 10 seconds, rest, repeat 5-10 times.',
      benefits: ['body_awareness', 'calming', 'focus'],
      icon: '💪',
      difficulty: 'easy',
    },
    {
      id: 'bear_crawl',
      name: 'Bear Crawls',
      age: [2, 8],
      description: 'Heavy work through limbs and joints',
      duration: '3-8 min',
      instructions: 'Move on hands and feet (inverted). Go across room slowly. Repeat 3-5 times.',
      benefits: ['body_awareness', 'strength', 'calming'],
      icon: '🐻',
      difficulty: 'moderate',
    },
    {
      id: 'pushing_game',
      name: 'Push-Pull Game',
      age: [3, 8],
      description: 'Partner pushing and pulling activity',
      duration: '5-10 min',
      instructions: 'Stand back-to-back. Push against partner. Switch directions. Take turns.',
      benefits: ['proprioceptive_input', 'cooperation', 'regulation'],
      icon: '🤝',
      difficulty: 'moderate',
    },
    {
      id: 'carry_task',
      name: 'Heavy Object Carrying',
      age: [3, 8],
      description: 'Carry weighted objects for input',
      duration: '5-10 min',
      instructions: 'Carry books, weighted toys, or buckets across room. Make it a "mission".',
      benefits: ['proprioceptive_input', 'focus', 'organization'],
      icon: '📦',
      difficulty: 'easy',
    },
  ],

  // Vestibular (balance, movement, spatial orientation)
  vestibular: [
    {
      id: 'spin_slow',
      name: 'Slow Spinning',
      age: [2, 8],
      description: 'Gentle rotational movement for balance',
      duration: '2-5 min',
      instructions: 'Stand and slowly spin 5-10 times. Stop and feel the movement. Rest, repeat.',
      benefits: ['balance', 'spatial_awareness', 'calming'],
      icon: '🌀',
      difficulty: 'easy',
    },
    {
      id: 'rock_back',
      name: 'Rocking Chair Time',
      age: [2, 8],
      description: 'Rhythmic rocking motion',
      duration: '5-10 min',
      instructions: 'Sit in rocker and rock slowly. Match with singing or counting.',
      benefits: ['regulation', 'rhythm_awareness', 'calming'],
      icon: '🪑',
      difficulty: 'easy',
    },
    {
      id: 'balance_beam',
      name: 'Balance Beam Walking',
      age: [3, 8],
      description: 'Walk along line or tape on floor',
      duration: '5-10 min',
      instructions: 'Walk heel-to-toe along a line. Make different patterns (walk, hop, skip).',
      benefits: ['balance', 'coordination', 'focus'],
      icon: '🚶',
      difficulty: 'moderate',
    },
    {
      id: 'jump_count',
      name: 'Jumping Pattern Play',
      age: [3, 8],
      description: 'Rhythmic jumping with counting or music',
      duration: '5-15 min',
      instructions: 'Jump in patterns. Count jumps. Add music. Make obstacle courses.',
      benefits: ['vestibular_input', 'coordination', 'rhythm'],
      icon: '🦘',
      difficulty: 'moderate',
    },
  ],

  // Tactile (touch, texture, sensory exploration)
  tactile: [
    {
      id: 'sensory_bin',
      name: 'Sensory Bin Exploration',
      age: [2, 8],
      description: 'Explore different textures in bins',
      duration: '10-20 min',
      instructions: 'Fill bin with rice, pasta, sand, water, beans. Let child explore freely.',
      benefits: ['tactile_input', 'exploration', 'calming'],
      icon: '🪣',
      difficulty: 'easy',
      prep: 'rice_pasta_sand_water_or_beans',
    },
    {
      id: 'playdough',
      name: 'Playdough Squishing',
      age: [2, 8],
      description: 'Heavy work with hands through dough',
      duration: '10-20 min',
      instructions: 'Squeeze, roll, pinch playdough. Hide objects to find. Make shapes.',
      benefits: ['fine_motor', 'stress_relief', 'tactile_input'],
      icon: '🎨',
      difficulty: 'easy',
      prep: 'playdough_or_homemade_recipe',
    },
    {
      id: 'painting',
      name: 'Finger Painting',
      age: [2, 8],
      description: 'Sensory art with hands',
      duration: '10-20 min',
      instructions: 'Use fingers to paint. Explore colors and textures. Focus on process not product.',
      benefits: ['tactile_input', 'creative_expression', 'calming'],
      icon: '🎨',
      difficulty: 'easy',
      prep: 'washable_paint_paper',
    },
    {
      id: 'texture_board',
      name: 'Texture Exploration Board',
      age: [2, 8],
      description: 'Feel different textures (rough, smooth, bumpy)',
      duration: '5-15 min',
      instructions: 'Create board with sandpaper, velvet, bumpy plastic, etc. Feel each texture.',
      benefits: ['tactile_discrimination', 'sensory_awareness', 'vocabulary'],
      icon: '🪨',
      difficulty: 'easy',
      prep: 'various_textures_glued_to_board',
    },
  ],

  // Auditory (sound, rhythm, music)
  auditory: [
    {
      id: 'drum_play',
      name: 'Drum Circle',
      age: [2, 8],
      description: 'Create rhythms with percussion',
      duration: '10-15 min',
      instructions: 'Use drums, pots, or spoons. Play together. Create simple patterns.',
      benefits: ['rhythm_awareness', 'coordination', 'expression'],
      icon: '🥁',
      difficulty: 'easy',
      prep: 'drums_or_pots_spoons',
    },
    {
      id: 'sound_hunt',
      name: 'Sound Hunt',
      age: [2, 8],
      description: 'Find and identify sounds around home',
      duration: '10-15 min',
      instructions: 'Listen for sounds. Make matching sounds. Talk about what you hear.',
      benefits: ['auditory_awareness', 'vocabulary', 'focus'],
      icon: '👂',
      difficulty: 'easy',
    },
    {
      id: 'sing_movement',
      name: 'Singing with Movement',
      age: [2, 8],
      description: 'Combine music with body movement',
      duration: '10-15 min',
      instructions: 'Sing songs. Add movements to match words. Create new verses together.',
      benefits: ['rhythm', 'coordination', 'language', 'joy'],
      icon: '🎵',
      difficulty: 'easy',
    },
    {
      id: 'echo_game',
      name: 'Echo Sound Game',
      age: [3, 8],
      description: 'Take turns making and repeating sounds',
      duration: '5-10 min',
      instructions: 'Make a sound. Child repeats. Switch roles. Get silly with sounds.',
      benefits: ['listening', 'turn_taking', 'language', 'fun'],
      icon: '🔊',
      difficulty: 'easy',
    },
  ],

  // Oral/Gustatory (taste, mouth movements)
  oral: [
    {
      id: 'crunchy_snack',
      name: 'Crunchy Snack Time',
      age: [2, 8],
      description: 'Eat crunchy foods for oral input',
      duration: '10-15 min',
      instructions: 'Offer crackers, carrots, apples, nuts (age-appropriate). Talk about sounds.',
      benefits: ['oral_sensory_input', 'attention', 'calming'],
      icon: '🥕',
      difficulty: 'easy',
    },
    {
      id: 'chewy_snack',
      name: 'Chewy Snack Play',
      age: [2, 8],
      description: 'Chew on safe items for oral input',
      duration: '5-10 min',
      instructions: 'Offer safe chewable snacks (fruit leather, gum). Chew slowly.',
      benefits: ['oral_input', 'regulation', 'focus'],
      icon: '🍎',
      difficulty: 'easy',
    },
    {
      id: 'tongue_play',
      name: 'Tongue and Mouth Movements',
      age: [2, 8],
      description: 'Silly mouth sounds and movements',
      duration: '5-10 min',
      instructions: 'Make mouth popping sounds, raspberries, funny faces. Have fun together.',
      benefits: ['oral_motor', 'speech_support', 'silliness', 'bonding'],
      icon: '👅',
      difficulty: 'easy',
    },
  ],

  // Visual (colors, light, patterns, movement)
  visual: [
    {
      id: 'color_hunt',
      name: 'Color Scavenger Hunt',
      age: [2, 8],
      description: 'Find objects of specific colors',
      duration: '10-15 min',
      instructions: 'Call out a color. Find items that match. Celebrate each find.',
      benefits: ['visual_attention', 'color_recognition', 'movement'],
      icon: '🌈',
      difficulty: 'easy',
    },
    {
      id: 'light_play',
      name: 'Light and Shadow Play',
      age: [2, 8],
      description: 'Explore light, shadows, and reflections',
      duration: '10-20 min',
      instructions: 'Use flashlight to make shadows. Look at reflections. Create light patterns.',
      benefits: ['visual_exploration', 'focus', 'wonder'],
      icon: '💡',
      difficulty: 'easy',
    },
    {
      id: 'bubble_watch',
      name: 'Bubble Watching',
      age: [2, 8],
      description: 'Blow and watch bubbles',
      duration: '10-15 min',
      instructions: 'Blow bubbles. Watch them float and pop. Chase gently. Feel the wonder.',
      benefits: ['visual_tracking', 'calm', 'focus', 'joy'],
      icon: '🫧',
      difficulty: 'easy',
      prep: 'bubble_solution_wand',
    },
    {
      id: 'pattern_maker',
      name: 'Pattern and Design Making',
      age: [3, 8],
      description: 'Create patterns with objects',
      duration: '10-20 min',
      instructions: 'Use blocks, toys, or natural items to create patterns. Talk about patterns.',
      benefits: ['visual_pattern_recognition', 'organization', 'creativity'],
      icon: '🧩',
      difficulty: 'moderate',
    },
  ],

  // Olfactory (smell, scent)
  olfactory: [
    {
      id: 'scent_jars',
      name: 'Scent Exploration Jars',
      age: [3, 8],
      description: 'Explore safe, pleasant scents',
      duration: '10-15 min',
      instructions: 'Create jars with cotton balls + lemon, vanilla, cinnamon, etc. Smell and name.',
      benefits: ['olfactory_awareness', 'vocabulary', 'calm'],
      icon: '👃',
      difficulty: 'easy',
      prep: 'jars_cotton_balls_safe_scents',
    },
    {
      id: 'flower_picking',
      name: 'Flower and Plant Exploration',
      age: [2, 8],
      description: 'Smell flowers, plants, herbs',
      duration: '10-20 min',
      instructions: 'Go outside or to a plant. Smell different plants. Talk about scents.',
      benefits: ['olfactory_awareness', 'nature_connection', 'calm'],
      icon: '🌸',
      difficulty: 'easy',
    },
  ],
};

// Helper function to get sensory activities by age
export const getSensoryActivitiesByAge = (age) => {
  const allActivities = Object.values(sensoryActivityOptions).flat();
  return allActivities.filter(activity => 
    activity.age[0] <= age && age <= activity.age[1]
  );
};

// Helper function to get sensory activities by type
export const getSensoryActivitiesByType = (type) => {
  return sensoryActivityOptions[type] || [];
};

// Daily sensory plan generator
export const generateDailySensoryPlan = (age, preferences = []) => {
  const available = getSensoryActivitiesByAge(age);
  
  // Create a balanced daily plan with different sensory types
  const types = ['proprioceptive', 'vestibular', 'tactile', 'auditory', 'visual'];
  const plan = [];
  
  types.forEach(type => {
    const typeActivities = sensoryActivityOptions[type].filter(a => a.age[0] <= age && age <= a.age[1]);
    if (typeActivities.length > 0) {
      const activity = typeActivities[Math.floor(Math.random() * typeActivities.length)];
      plan.push(activity);
    }
  });

  return plan;
};

// Sensory break suggestions based on behavior
export const sensoryBreakSuggestions = {
  overstimulated: [
    'Slow rocking in chair',
    'Wall pushes',
    'Quiet sitting with favorite toy',
    'Gentle music',
    'Deep breathing with color watching',
  ],
  understimulated: [
    'Jumping and bouncing',
    'Drum circle',
    'Running and climbing',
    'Fast movement games',
    'Spinning activity',
  ],
  needsFocus: [
    'Heavy work (carrying, pushing)',
    'Structured drum pattern',
    'Balance beam walking',
    'Organized building activity',
    'Clear visual pattern making',
  ],
  needsCalming: [
    'Rocking motion',
    'Wall pushes',
    'Playdough squishing',
    'Gentle singing',
    'Soft lighting and bubbles',
  ],
};
