#!/usr/bin/env python3
import google.generativeai as genai
import PIL.Image
import os
import sys
import time
import json
import random
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Try to import elevenlabs for audio generation
try:
    from elevenlabs import ElevenLabs
    ELEVENLABS_AVAILABLE = True
    # Use actual ElevenLabs voice IDs
    VOICES = [
        "21m00Tcm4TlvDq8ikWAM",  # Rachel
        "2EiwWnXFnvU5JabPnv8n",  # Clyde  
        "N2lVS1w4EtoT3dr4eOWO",  # Callum
        "EXAVITQu4vr4xnSDxMaL"   # Sarah
    ]
    # Initialize client
    elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
except ImportError:
    ELEVENLABS_AVAILABLE = False
    elevenlabs_client = None

def generate_story_with_voice_description(image_description: str, story_customization: str, image_path: str) -> tuple:
    """Generate story and voice description using the exact ArTales notebook approach."""
    try:
        art_style_image = PIL.Image.open(image_path)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Use the exact ArTales prompt
        script_prompt = [
            f"""You are a skilled storyteller in the style of 'Krish Trish and Baltiboy.' Your task is to generate four distinct outputs based on the provided `image_description` and your expertise.

### **1. Story Generation**
Create a short story of at least **100 words** that directly tells the narrative of the given image. The story must be a direct interpretation of the image's content, not an invented tale. It should be dialogue-heavy and designed to be easily converted into an audio file. The story must keep the `image_description` and `story_customization` in mind as its primary sources.

### **2. Trailer Generation**
Based on the story you have created, write a trailer script. This trailer should be  give a good background to the image. It must not include any dialogue, narration, or timestamps. Instead, it should focus entirely on atmospheric background sounds and effects that strongly align with the given art type and art style. The sounds should convey the essence and mood of the story without words.

### **3. Refined Description**
Your final task is to format and present the original user-provided `image_description` in a clear, refined manner. This description should be a direct reproduction of the content given in the `image_description` variable.

### **4. Voice Description**
Describe the ideal voice characteristics for narrating this story, considering the tone, characters, and art style. The description should be detailed and in the style of the ElevenLabs voice design prompts.

### **RESPONSE FORMAT**
Present your final output as a single, structured response with the following sections, using clear headings for easy parsing:

#### **1. Story**

- **Title:** A short, catchy title for the story.

- **Narrative:** The full story, at least 100 words, with dialogue.

#### **2. Trailer**

- **Script:** A description of atmospheric background sounds and effects only, without dialogues, narration, or timestamps. These sounds should naturally reflect the art type and art style.

#### **3. Refined Description**

- **Summary:** The original `image_description`, formatted neatly.

#### **4. Voice Description**

- **Narrator Voice:** A **concise and direct** description of the ideal voice for the overall narration. Focus on age, tone, accent, and pitch using keywords and phrases. For example: "A warm, slightly aged female voice, reminiscent of a loving grandmother with a melodious Karnataka accent. The tone is clear and comforting. Mid-range pitch, moderate pace."


**Crucial Instructions:**

- **Story:** Use the `image_description` as the source of truth for all narrative and atmospheric elements. (The story should be of MAX 1000 Characters)
- **Trailer:** Only include background sounds and effects, strictly no dialogue and no narration and no timestamps.
- **Dialogue in Story:** Ensure the story itself remains dialogue-heavy, making it ready for an audio-first approach.
- **Art Style:** The final output must feel authentic to the art and essence found in the `art_style_image`.
- **Voice Description:** The voice description should be optimized for direct use with the ElevenLabs voice design API. The voice should be strictly Indian but can be from different parts of India.

**Image Description:** {image_description}

**Story Customization:** {story_customization}

**Art Style Image:** {art_style_image}

""",
            art_style_image
        ]
        
        response = model.generate_content(script_prompt)
        generated_script = response.text.strip()
        
        # Parse the response to extract story and voice description
        story = ""
        voice_description = ""
        
        # Extract story narrative - try multiple patterns
        narrative_patterns = ["**Narrative:**", "- **Narrative:**", "Narrative:"]
        for pattern in narrative_patterns:
            if pattern in generated_script:
                narrative_start = generated_script.find(pattern)
                narrative_section = generated_script[narrative_start + len(pattern):]
                
                # Find the end of the narrative section
                end_patterns = ["#### **2. Trailer**", "####", "\n\n#### **", "\n\n**2."]
                narrative_end = -1
                for end_pattern in end_patterns:
                    end_pos = narrative_section.find(end_pattern)
                    if end_pos != -1:
                        narrative_end = end_pos
                        break
                
                if narrative_end != -1:
                    story = narrative_section[:narrative_end].strip()
                else:
                    story = narrative_section[:1000].strip()  # Take first 1000 chars
                break
        
        # Extract voice description - try multiple patterns
        voice_patterns = ["**Narrator Voice:**", "- **Narrator Voice:**", "Narrator Voice:"]
        for pattern in voice_patterns:
            if pattern in generated_script:
                voice_start = generated_script.find(pattern)
                voice_section = generated_script[voice_start + len(pattern):]
                voice_end = voice_section.find("\n\n")
                if voice_end != -1:
                    voice_description = voice_section[:voice_end].strip()
                else:
                    voice_description = voice_section[:300].strip()
                break
        
        # Clean up story
        if story:
            story = story.replace('**', '').replace('- ', '').strip()
            # Remove any remaining markdown or formatting
            story = story.replace('*', '').strip()
        
        # If we have a good story, return it
        if story and len(story) > 50:
            return story, voice_description
        
        # If parsing failed, try line-by-line extraction
        lines = generated_script.split('\n')
        story_lines = []
        capturing_story = False
        
        for line in lines:
            line = line.strip()
            if 'Narrative:' in line:
                capturing_story = True
                continue
            elif capturing_story and line:
                if line.startswith('####') or 'Trailer' in line or '**2.' in line:
                    break
                if not line.startswith('**') and not line.startswith('-'):
                    story_lines.append(line)
        
        if story_lines:
            story = ' '.join(story_lines).strip()
        
        return story, voice_description
        
    except Exception as e:
        # Log the error for debugging
        print(f"ERROR in story generation: {str(e)}", file=sys.stderr)
        
        # Fallback story if Gemini fails
        fallback_story = f"""In the heart of a traditional palace, where ancient customs meet deep emotions, this poignant moment unfolds. {image_description}

"My son," whispered the elder, his voice heavy with sorrow. "What have we done?"

The younger figure lay still, the weight of tragedy filling the ornate chamber. The intricate patterns on the carpet seemed to echo the complexity of their relationship - love intertwined with conflict, tradition clashing with passion.

"Forgive me," the elder continued, his hands trembling. "My anger... my pride... it has cost us everything."

This moment captures the eternal struggle between duty and love, between the old ways and the heart's true calling."""
        
        return fallback_story, "A warm, aged male voice with a deep Indian accent. Mournful and reflective tone, slow deliberate pace."

def select_voice_based_on_description(voice_description: str) -> str:
    """Select the best predefined voice based on the voice description."""
    voice_desc_lower = voice_description.lower()
    
    # Map voice descriptions to appropriate voice IDs
    if "female" in voice_desc_lower or "woman" in voice_desc_lower:
        if "aged" in voice_desc_lower or "grandmother" in voice_desc_lower:
            return "EXAVITQu4vr4xnSDxMaL"  # Sarah - mature female
        else:
            return "21m00Tcm4TlvDq8ikWAM"  # Rachel - clear female
    elif "male" in voice_desc_lower or "man" in voice_desc_lower:
        if "aged" in voice_desc_lower or "elder" in voice_desc_lower or "deep" in voice_desc_lower:
            return "2EiwWnXFnvU5JabPnv8n"  # Clyde - mature male
        else:
            return "N2lVS1w4EtoT3dr4eOWO"  # Callum - clear male
    else:
        # Default based on tone
        if "warm" in voice_desc_lower or "comforting" in voice_desc_lower:
            return "21m00Tcm4TlvDq8ikWAM"  # Rachel
        else:
            return "2EiwWnXFnvU5JabPnv8n"  # Clyde

def text_to_speech_with_voice_design(story: str, voice_description: str, output_file: str = "output.mp3") -> str:
    """Convert story text into speech using the best matching predefined voice for full stories."""
    if not ELEVENLABS_AVAILABLE or not elevenlabs_client:
        raise Exception("ElevenLabs module not available")
    
    try:
        # Select the best voice based on description
        selected_voice_id = select_voice_based_on_description(voice_description)
        print(f"Selected voice ID: {selected_voice_id} based on description: {voice_description[:50]}...", file=sys.stderr)
        
        # Generate audio with the selected voice
        audio = elevenlabs_client.text_to_speech.convert(
            text=story,
            voice_id=selected_voice_id,
            model_id="eleven_multilingual_v2"
        )
        
        with open(output_file, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        
        return os.path.abspath(output_file)
        
    except Exception as e:
        # Final fallback with random voice and shorter text
        try:
            print(f"Voice selection failed, using random voice: {str(e)}", file=sys.stderr)
            voice_id = random.choice(VOICES)
            
            # Limit text length to avoid quota issues
            fallback_text = story[:200] if len(story) > 200 else story
            
            audio = elevenlabs_client.text_to_speech.convert(
                text=fallback_text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2"
            )
            
            with open(output_file, "wb") as f:
                for chunk in audio:
                    f.write(chunk)
            
            return os.path.abspath(output_file)
        except Exception as fallback_error:
            raise Exception(f"All audio generation methods failed: {str(e)}, Final fallback: {str(fallback_error)}")

def main():
    try:
        if len(sys.argv) != 5:
            print(json.dumps({
                "success": False,
                "error": "Usage: python generate_story_final.py <image_path> <description> <story_type> <output_dir>"
            }))
            sys.exit(1)
        
        image_path = sys.argv[1]
        description = sys.argv[2]
        story_type = sys.argv[3]
        output_dir = sys.argv[4]
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate story and voice description using the exact ArTales notebook approach
        story, voice_description = generate_story_with_voice_description(description, story_type, image_path)
        
        # Generate audio using voice design if ElevenLabs is available
        audio_path = None
        if ELEVENLABS_AVAILABLE and voice_description:
            try:
                timestamp = int(time.time())
                audio_filename = f"story_audio_{timestamp}.mp3"
                audio_full_path = os.path.join(output_dir, audio_filename)
                
                # Use full story for audio generation with smart voice selection
                audio_story = story
                
                text_to_speech_with_voice_design(audio_story, voice_description, audio_full_path)
                audio_path = audio_full_path
                
            except Exception as audio_error:
                print(f"Audio generation failed: {audio_error}", file=sys.stderr)
                pass  # Audio generation failed, continue without audio
        
        # Return result in JSON format
        result = {
            "success": True,
            "story": story,
            "audio_path": audio_path,
            "message": "Story and audio generated successfully" if audio_path else "Story generated successfully"
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()