// World-class lesson content generation system
// Based on child development research, evidence-based pedagogy, and age/milestone-appropriate progression
// Integrates Montessori, Waldorf, Reggio, and contemporary neuroscience approaches

export const developmentalFramework = {
  // Age-based cognitive and motor development stages (Piaget + modern research)
  ageStages: {
    2: {
      cognitiveStage: 'sensorimotor_to_preoperational',
      characteristics: ['object_permanence', 'symbolic_play', 'language_explosion', 'parallel_play'],
      attention: { duration: '2-5 minutes', focus: 'objects_actions' },
      motorSkills: ['gross_motor_refinement', 'pincer_grasp_developing', 'simple_commands'],
      socialEmotional: ['separation_anxiety', 'parallel_play', 'self_awareness_emerging'],
      language: ['50-200_words', 'two_word_phrases', 'repetition_loving'],
      pedagogy: 'sensory_exploration_through_objects_and_repetition',
    },
    3: {
      cognitiveStage: 'preoperational',
      characteristics: ['imagination_flourishing', 'magical_thinking', 'cannot_conserve', 'centration'],
      attention: { duration: '5-10 minutes', focus: 'narrative_patterns' },
      motorSkills: ['running_climbing', 'pedaling', 'drawing_scribbles_to_shapes', 'self_feeding'],
      socialEmotional: ['cooperative_play_emerging', 'emotional_expression', 'independent_play_longer'],
      language: ['200-1000_words', 'three_to_four_word_sentences', 'asking_why', 'storytelling_starts'],
      pedagogy: 'play_based_learning_with_sensory_materials_and_stories',
    },
    4: {
      cognitiveStage: 'preoperational_consolidating',
      characteristics: ['symbolic_thinking_strong', 'still_magical_thinking', 'cause_effect_understanding'],
      attention: { duration: '10-15 minutes', focus: 'connected_narratives' },
      motorSkills: ['balance_improving', 'fine_motor_control', 'drawing_recognizable', 'cutting_scissors'],
      socialEmotional: ['cooperative_play_established', 'empathy_emerging', 'friendship_understanding'],
      language: ['1000_plus_words', 'complex_sentences', 'asking_how_why', 'creative_language_play'],
      pedagogy: 'project_based_discovery_with_guided_exploration_and_group_activities',
    },
    5: {
      cognitiveStage: 'preoperational_late',
      characteristics: ['reasoning_developing', 'sequencing', 'classification_attempts', 'counting_understand'],
      attention: { duration: '15-20 minutes', focus: 'cause_effect_chains' },
      motorSkills: ['running_skills_solid', 'skipping_starting', 'fine_motor_control', 'writing_letters'],
      socialEmotional: ['group_play_rules', 'friendship_development', 'self_control_improving'],
      language: ['sentences_4_to_5_words', 'grammar_mostly_correct', 'storytelling_detailed', 'jokes_riddles'],
      pedagogy: 'structured_exploration_with_clear_cause_effect_and_beginning_academic_concepts',
    },
    6: {
      cognitiveStage: 'concrete_operational_emerging',
      characteristics: ['logical_thinking_emerging', 'conservation_beginning', 'reversibility', 'classification_solid'],
      attention: { duration: '20-30 minutes', focus: 'systematic_learning' },
      motorSkills: ['fine_motor_coordination', 'printing_letters_numbers', 'sports_skills', 'tool_use'],
      socialEmotional: ['rule_follower', 'team_player', 'competitive_sports', 'friendship_intense'],
      language: ['complex_sentences', 'reading_readiness', 'expanding_vocabulary', 'more_formal_speech'],
      pedagogy: 'skill_based_learning_with_rules_structure_and_beginning_abstract_concepts',
    },
    7: {
      cognitiveStage: 'concrete_operational',
      characteristics: ['logical_reasoning', 'conservation_solid', 'seriation', 'classification_advanced'],
      attention: { duration: '30_plus_minutes', focus: 'academic_learning' },
      motorSkills: ['handwriting_fluent', 'sports_participation', 'fine_coordination_solid'],
      socialEmotional: ['rule_respecting', 'peer_relationships_primary', 'school_identity'],
      language: ['reading_writing_developing', 'sophisticated_vocabulary', 'humor_sophisticated'],
      pedagogy: 'academic_foundations_with_hands_on_materials_and_structured_activities',
    },
    8: {
      cognitiveStage: 'concrete_operational_advanced',
      characteristics: ['systematic_thinking', 'time_understanding', 'cause_effect_complex', 'perspective_taking'],
      attention: { duration: '30_plus_minutes', focus: 'complex_projects' },
      motorSkills: ['fine_motor_mastery', 'organized_sports', 'writing_facility'],
      socialEmotional: ['collaboration_skilled', 'peer_influence_strong', 'self_competence_important'],
      language: ['reading_comprehension', 'expository_writing', 'argument_understanding'],
      pedagogy: 'integrated_projects_with_multiple_perspectives_and_collaborative_learning',
    },
  },

  // Pedagogical strategies by development level
  strategies: {
    sensory_exploration_through_objects_and_repetition: {
      principles: ['repetition_builds_neural_pathways', 'sensory_input_essential', 'object_handling_critical'],
      activities: [
        'manipulate_objects_freely',
        'sensory_bins_textures_sounds',
        'repetitive_songs_movements',
        'object_permanence_games',
        'simple_cause_effect_toys',
      ],
      duration: '2_5_minutes_with_breaks',
      language: 'simple_labels_and_narration',
      scaffolding: 'minimal_adult_direction_mostly_observation',
    },
    play_based_learning_with_sensory_materials_and_stories: {
      principles: ['play_is_learning', 'imagination_development', 'sensory_integration', 'narrative_comprehension'],
      activities: [
        'pretend_play_scenarios',
        'sensory_explorations_water_sand',
        'storytelling_with_props',
        'music_and_movement',
        'collaborative_play_with_peer',
      ],
      duration: '10_20_minutes_blocks',
      language: 'descriptive_language_asking_questions_encouraging_narration',
      scaffolding: 'guided_participation_adult_models_behavior',
    },
    project_based_discovery_with_guided_exploration_and_group_activities: {
      principles: ['hands_on_experimentation', 'following_childs_interests', 'group_learning', 'process_over_product'],
      activities: [
        'exploration_projects_open_ended',
        'sorting_categorizing_activities',
        'simple_experiments_observation',
        'group_singing_movement',
        'collaborative_art_projects',
      ],
      duration: '15_30_minutes_with_transitions',
      language: 'questioning_encouraging_predictions_discussing_observations',
      scaffolding: 'co_exploration_adult_asks_opens_possibilities',
    },
    structured_exploration_with_clear_cause_effect_and_beginning_academic_concepts: {
      principles: ['cause_and_effect_understanding', 'beginning_literacy_numeracy', 'structured_activities', 'peer_learning'],
      activities: [
        'phonemic_awareness_games',
        'number_recognition_activities',
        'pattern_identification',
        'simple_science_observations',
        'cooperative_games_with_rules',
      ],
      duration: '20_30_minutes_focused_periods',
      language: 'explanations_of_cause_effect_vocabulary_building_encouraging_questions',
      scaffolding: 'structured_guidance_with_clear_steps_and_repetition',
    },
    skill_based_learning_with_rules_structure_and_beginning_abstract_concepts: {
      principles: ['skill_mastery', 'understanding_rules', 'beginning_abstract_thinking', 'competition_friendly'],
      activities: [
        'letter_and_sound_instruction',
        'number_operations',
        'reading_stories',
        'games_with_rules',
        'skill_based_sports',
      ],
      duration: '30_45_minutes_academic_blocks',
      language: 'clear_instructions_vocabulary_specific_discussion_of_strategies',
      scaffolding: 'direct_instruction_with_guided_practice_and_independent_application',
    },
    academic_foundations_with_hands_on_materials_and_structured_activities: {
      principles: ['academic_skill_building', 'concrete_manipulatives_for_abstract', 'achievement_motivation', 'peer_collaboration'],
      activities: [
        'phonics_instruction',
        'math_problem_solving',
        'reading_comprehension',
        'research_projects',
        'team_based_activities',
      ],
      duration: '45_60_minute_lessons',
      language: 'explicit_instruction_metacognitive_discussion_collaborative_dialogue',
      scaffolding: 'gradual_release_responsibility_from_modeling_to_guided_to_independent',
    },
    integrated_projects_with_multiple_perspectives_and_collaborative_learning: {
      principles: ['integrated_curriculum', 'higher_order_thinking', 'collaboration_essential', 'perspective_taking'],
      activities: [
        'multi_subject_projects',
        'research_and_presentation',
        'collaborative_problem_solving',
        'peer_teaching',
        'service_learning',
      ],
      duration: '60_plus_minute_blocks',
      language: 'socratic_questioning_argumentative_discussion_metacognitive_reflection',
      scaffolding: 'minimal_support_coaching_for_independence_and_advanced_thinking',
    },
  },

  // Voice guidance for lesson narration
  voiceGuidance: {
    2: {
      pace: 'slow_clear_deliberate',
      vocabulary: 'simple_one_two_word_labels',
      sentences: 'short_simple_statements_maximum_5_words',
      repetition: 'high_repeated_labels_and_sounds',
      pauses: 'long_pauses_for_processing_3_5_seconds',
      emotionalTone: 'warm_gentle_encouraging',
      volume: 'moderate_clear_easy_to_hear',
      musicality: 'sing_song_rhythm_for_engagement',
    },
    3: {
      pace: 'moderate_clear',
      vocabulary: 'simple_concrete_words',
      sentences: 'short_sentences_3_to_5_words',
      repetition: 'moderate_repetition_of_key_words',
      pauses: 'pauses_for_responses_2_3_seconds',
      emotionalTone: 'warm_enthusiastic_playful',
      volume: 'clear_engaging',
      musicality: 'rhythm_patterns_songs_for_learning',
    },
    4: {
      pace: 'natural_with_emphasis',
      vocabulary: 'concrete_with_beginning_abstract',
      sentences: 'simple_to_compound_4_to_8_words',
      repetition: 'moderate_with_varied_expression',
      pauses: 'natural_pauses_for_reflection',
      emotionalTone: 'warm_encouraging_builds_confidence',
      volume: 'clear_expressive',
      musicality: 'rhythm_patterns_melodic_language_play',
    },
    5: {
      pace: 'natural_engaging',
      vocabulary: 'mix_concrete_and_abstract',
      sentences: 'simple_to_complex_6_to_10_words',
      repetition: 'minimal_repetition_varied_expressions',
      pauses: 'strategic_pauses_for_thinking',
      emotionalTone: 'warm_supportive_encouraging_independence',
      volume: 'clear_expressive_dynamic',
      musicality: 'narrative_flow_poetic_language',
    },
    6: {
      pace: 'natural_conversational',
      vocabulary: 'grade_level_appropriate_sophisticated',
      sentences: 'complex_sentences_natural_length',
      repetition: 'minimal_variation_in_phrasing',
      pauses: 'natural_pauses_for_reflection_and_response',
      emotionalTone: 'genuine_supportive_respectful',
      volume: 'clear_expressive_appropriate',
      musicality: 'narrative_structure_engaging_storytelling',
    },
    7: {
      pace: 'natural_engaging_dynamic',
      vocabulary: 'sophisticated_grade_level_appropriate',
      sentences: 'complex_varied_natural_language',
      repetition: 'strategic_emphasis_no_redundant_repetition',
      pauses: 'natural_pauses_for_reflection_and_response',
      emotionalTone: 'genuine_respectful_motivating',
      volume: 'clear_expressive_dynamic_engaging',
      musicality: 'sophisticated_narrative_engaging_presentation',
    },
    8: {
      pace: 'natural_engaging_professional',
      vocabulary: 'sophisticated_challenging_appropriate',
      sentences: 'complex_sophisticated_natural_language',
      repetition: 'strategic_emphasis_for_clarity',
      pauses: 'natural_pauses_for_deep_reflection',
      emotionalTone: 'genuine_respectful_challenging_motivating',
      volume: 'clear_expressive_professional',
      musicality: 'sophisticated_engaging_professional_presentation',
    },
  },

  // Support needs adaptations
  supportNeedsAdaptations: {
    nonVerbal: {
      modifications: ['visual_supports', 'sign_language', 'AAC_devices', 'gesture_focused'],
      lessonsAdjustment: 'emphasis_on_movement_visual_communication_gesture',
      assessmentMethod: 'camera_based_gesture_recognition_pointing_eye_gaze',
    },
    motorDelays: {
      modifications: ['modified_equipment', 'larger_objects', 'adaptive_tools', 'supported_positioning'],
      lessonsAdjustment: 'emphasis_on_head_arm_hand_movements_within_ability',
      assessmentMethod: 'camera_based_modified_action_recognition',
    },
    hearingImpaired: {
      modifications: ['visual_supports', 'captions', 'sign_language', 'written_prompts'],
      lessonsAdjustment: 'emphasis_on_visual_demonstration_sign_language_written_instructions',
      assessmentMethod: 'camera_based_observation_visual_communication',
    },
    visualImpairment: {
      modifications: ['verbal_descriptions', 'tactile_objects', 'audio_focused', 'large_text'],
      lessonsAdjustment: 'emphasis_on_verbal_narration_tactile_exploration_audio_support',
      assessmentMethod: 'audio_based_assessment_verbal_responses',
    },
    attentionChallenges: {
      modifications: ['shorter_activities', 'high_novelty', 'frequent_breaks', 'multisensory'],
      lessonsAdjustment: 'emphasis_on_engaging_activities_frequent_changes_reward_system',
      assessmentMethod: 'multiple_short_checks_with_positive_reinforcement',
    },
  },
};

// Generate lesson prompt for AI voice and activity
export const generateLessonPrompt = (kidName, age, subject, developmental_milestone, support_needs) => {
  const stage = developmentalFramework.ageStages[age] || developmentalFramework.ageStages[4];
  const voiceGuide = developmentalFramework.voiceGuidance[age] || developmentalFramework.voiceGuidance[4];
  const strategy = developmentalFramework.strategies[stage.pedagogy] || {};

  return `
## Lesson Planning Context
- Child Name: ${kidName}
- Age: ${age} years old
- Developmental Stage: ${stage.cognitiveStage}
- Developmental Milestone Focus: ${developmental_milestone || 'age-typical progression'}
- Support Needs: ${support_needs || 'none identified'}
- Attention Span: ${stage.attention.duration}

## Pedagogical Approach
Use this framework: ${stage.pedagogy}
- Key Principles: ${strategy.principles?.join(', ') || 'age-appropriate play-based learning'}
- Recommended Activities: ${strategy.activities?.join(', ') || 'hands-on exploration'}
- Scaffolding Method: ${strategy.scaffolding || 'guided participation'}

## Voice and Language Guidance
- Pace: ${voiceGuide.pace}
- Vocabulary Level: ${voiceGuide.vocabulary}
- Sentence Length: ${voiceGuide.sentences}
- Repetition: ${voiceGuide.repetition}
- Pauses: ${voiceGuide.pauses}
- Emotional Tone: ${voiceGuide.emotionalTone}
- Volume: ${voiceGuide.volume}
- Musicality: ${voiceGuide.musicality}
- USE ${kidName}'S NAME FREQUENTLY throughout

## Quality Standards
- Content must be evidence-based
- Activities must match child's developmental stage
- Voice must sound genuine and warm
- Language must be age-appropriate
- Make it engaging and encouraging
`;
};
