==========================================
  GDPVal Task Creator - Reference Examples
==========================================

This folder contains sample files demonstrating the correct
format for each task type in the GDPVal Benchmark Suite.

FOLDER STRUCTURE:
-----------------

1. text_samples/
   - Contains example text files (.txt)
   - Use for: Text-to-Text, Text-to-Image, Text-to-Audio, Text-to-Video tasks

2. image_samples/
   - Contains example images (.jpg, .png)
   - Use for: Image-to-Text, Image-to-Image tasks

3. audio_samples/
   - Contains example audio files (.mp3, .wav)
   - Use for: Audio-to-Text tasks

4. video_samples/
   - Contains example video files (.mp4)
   - Use for: Video-to-Text tasks


NAMING CONVENTION:
------------------
Files should be named descriptively to indicate their content.
Example: "sunset_beach.jpg", "podcast_intro.mp3"


TASK EXAMPLES:
--------------

Text-to-Text:
  Input: text_samples/story_prompt.txt
  Expected: A continuation or response to the prompt

Text-to-Image:
  Input: text_samples/image_description.txt
  Expected: Generated image matching the description

Image-to-Text:
  Input: image_samples/sample_photo.jpg
  Expected: Description or analysis of the image

Audio-to-Text:
  Input: audio_samples/speech_sample.mp3
  Expected: Transcription of the audio

Video-to-Text:
  Input: video_samples/sample_clip.mp4
  Expected: Description or summary of the video


For more information, visit the GDPVal documentation.
