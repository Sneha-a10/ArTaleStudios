#!/usr/bin/env python3
import sys
import json

try:
    import google.generativeai as genai
    print("✅ google.generativeai imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"❌ Failed to import google.generativeai: {e}", file=sys.stderr)

try:
    import PIL.Image
    print("✅ PIL.Image imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"❌ Failed to import PIL.Image: {e}", file=sys.stderr)

try:
    from elevenlabs import ElevenLabs
    print("✅ elevenlabs imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"❌ Failed to import elevenlabs: {e}", file=sys.stderr)

try:
    from dotenv import load_dotenv
    print("✅ dotenv imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"❌ Failed to import dotenv: {e}", file=sys.stderr)

# Test basic functionality
print(json.dumps({"success": True, "message": "Python test completed"}))