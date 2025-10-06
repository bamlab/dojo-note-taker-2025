import { useEffect, useState } from 'react';
import { Text, View, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import axios from 'axios';

const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';

export default function App() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const [summary, setSummary] = useState<string | null>();
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission to access microphone was denied');
      }

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  const record = async () => {
    setSummary(null);

    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const stopRecording = async () => {
    setIsSummarizing(true);

    await audioRecorder.stop();

    const uri = audioRecorder.uri;
    console.log('Recording stopped and stored at', uri);

    if (uri === null) {
      setIsSummarizing(false);
      return;
    }

    console.log('Sending the recording to the OpenAI API...\n');
    const text = await speechToText(uri);

    if (text === null) {
      setIsSummarizing(false);
      return;
    }

    console.log('Summarizing the transcript...\n');
    const summary = await summarizeText(text);

    if (summary === null) {
      setIsSummarizing(false);
      return;
    }

    setSummary(summary);
    setIsSummarizing(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {summary
          ? summary
          : 'Start the recording to take a note. The summary of the note will appear after you stop the recording.'}
      </Text>
      <Pressable onPress={recorderState.isRecording ? stopRecording : record} style={styles.button}>
        <MaterialIcons name={recorderState.isRecording ? 'stop' : 'mic'} size={24} color="black" />
        <Text style={styles.title}>
          {recorderState.isRecording ? 'Stop and summarize' : 'New Recording'}
        </Text>
      </Pressable>
      {isSummarizing && (
        <View>
          <ActivityIndicator size="small" color="black" />
        </View>
      )}
    </View>
  );
}

const speechToText = async (uri: string) => {
  const formData = new FormData();
  const file = {
    uri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any;
  formData.append('file', file);
  formData.append('model', 'gpt-4o-transcribe');

  try {
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('OpenAI API response:', response.data);

    return response.data.text as string;
  } catch (error) {
    console.error('Error getting transcript from OpenAI API:', error);
    return null;
  }
};

const summarizeText = async (text: string) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        messages: [
          {
            role: 'developer',
            content: 'Summarize the given transcript.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        model: 'gpt-5',
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    console.log('ChatGPT summary response:', response.data);

    return response.data.choices[0].message.content as string;
  } catch (error) {
    console.error('Error summarizing transcript with ChatGPT:', error);
    return null;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
    backgroundColor: 'white',
  },
  text: {
    fontSize: 16,
    color: 'black',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    height: 64,
    borderRadius: 12,
    backgroundColor: '#205735',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5, // For Android shadow
  },
});
