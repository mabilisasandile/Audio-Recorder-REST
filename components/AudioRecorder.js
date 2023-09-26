import React, { useState, useEffect } from 'react';
import {
  View, Text, Button, FlatList, StyleSheet, Alert,
  TextInput, TouchableOpacity, Modal
} from 'react-native';
import { Card } from '@rneui/themed';
import { Audio } from 'expo-av';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faStop, faMicrophone, faPlay, faPause, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDownloadURL, uploadBytes, ref, deleteObject } from 'firebase/storage';
import { useNavigation } from "@react-navigation/native";
import axios from 'axios';



const recordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
    audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
    audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};


const projectId = "audio-recorder-67133";
const apiKey = "AIzaSyBVxolW1kr1EUIk-j02yRX_wN4844N2JtY";
const firestoreBaseUrl = 'https://firestore.googleapis.com/v1';
const collectionName = "recordings";
const storageBaseUrl = 'https://www.googleapis.com/upload/storage/v1';
const storageBucket = "audio-recorder-67133.appspot.com";
const storageUrl = `https://storage.googleapis.com/storage/v1/b/${storageBucket}/o`;

// Upload
// `${storageBaseUrl}/b/${storageBucket}/o?uploadType=media&name=audio/${audioTitle}`
// https://www.googleapis.com/upload/storage/v1/b/audio-recorder-67133.appspot.com/o?uploadType=media&name=audio/fri100  

// Retrieve
// https://firestore.googleapis.com/v1/projects/audio-recorder-67133/databases/(default)/documents/recordings?key=AIzaSyBVxolW1kr1EUIk-j02yRX_wN4844N2JtY

export default function AudioRecorder() {

  const [current_user, setUser] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [recording, setRecording] = useState(null);
  const [audioTitle, setAudioTitle] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [idToken, setIdToken] = useState(null);
  const [storageFileUrl, setRecordURL] = useState(null);

  useEffect(() => {
    const fetchIdToken = async () => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
        console.log("ID Token:", token);
      }
    };

    fetchIdToken();
  }, []);



  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    getSavedAudios();
  }, []);


  const navigation = useNavigation();



  // retrieve the saved recordings from Firebase Storage/Firestore
  const getSavedAudios = async () => {
    try {

      const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?key=${apiKey}`;
      const response = await fetch(endpoint);
      const responseData = await response.json();
      const documents = responseData.documents || [];
      const savedRecordings = []
      documents.forEach(document => {
        const data = document.fields; // Assuming data is stored in "fields"
        const parts = document.name.split('/');
        const id = parts[parts.length - 1]; // The last part is the document ID
        let normalObject = {}
        for (let key in data) {
          normalObject = { ...normalObject, [key]: data[key].stringValue }
        }
        savedRecordings.push({ id: id, normalObject })
      });

      setRecordings(savedRecordings);
      console.log("Saved Recordings:", savedRecordings);

    } catch (error) {
      console.log("Failed to fetch saved audios", error);
    }
  };


  // request permission to access the microphone and start recording
  const startRecording = async () => {

    try {
      const permission = await Audio.requestPermissionsAsync();

      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          recordingOptions
        );
        setRecording(recording);
      } else {
        setMessage("Please grant permission to app to access microphone");
        setErrorMessage(message);
      }

    } catch (error) {
      console.log("Failed to start recording", error);
      setErrorMessage("Failed to start recording!", error);
    }
  };



  //Get the duration
  function getDurationFormatted(millis) {

    if (isNaN(millis)) {
      return "Invalid duration";
    }

    const minutes = millis / 1000 / 60;
    const minutesDisplay = Math.floor(minutes);
    const seconds = Math.round((minutes - minutesDisplay) * 60);
    const secondsDisplay = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutesDisplay}:${secondsDisplay}`;
  }



  // stop the active recording and save recorded audio
  const stopRecording = async () => {
    try {
      setRecording(undefined);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const getURI = recording.getURI();
      const { sound, status } = await recording.createNewLoadedSoundAsync();

      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          try {
            resolve(xhr.response);
          } catch (error) {
            console.log("error:", error);
          }
        };
        xhr.onerror = (e) => {
          console.log(e);
          reject(new TypeError("Network request failed"));
        };
        xhr.responseType = "blob";
        xhr.open("GET", getURI, true);
        xhr.send(null);
      });

      if (blob != null) {
        
        // Upload audio file to Firebase Storage
        const apiUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(audioTitle)}`;
        const storageRef = await fetch(apiUrl, {
            method: 'POST',
            headers: 'Content-Type',
            body: blob,
        });
        blob.close()
        if (storageRef) {
            const data = await storageRef.json();
            console.log(data)
            try {
                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(audioTitle)}?alt=media&token=${data.downloadTokens}`;
                const recordingUrl = downloadUrl;
                console.log('File uploaded successfully. Download URL:', recordingUrl);
                setRecordURL(recordingUrl);
            } catch (err){
                console.log('File did not upload' , err);
            }
          } else {
            console.error('File upload failed');
        }

        // Create a new recording document in Firestore
        const firestoreUrl = `${firestoreBaseUrl}/projects/${projectId}/databases/(default)/documents/${collectionName}?&key=${apiKey}`;
        const firestoreData = {
          fields: {
            title: { stringValue: audioTitle },
            duration: { stringValue: getDurationFormatted(status.durationMillis) },
            fileUrl: { stringValue: storageFileUrl },
            file: { stringValue: getURI },
          },
        };

        await fetch(firestoreUrl, {
          method: "POST", headers: {
            "Content-type": "application/json"
          }, 
          body: JSON.stringify(firestoreData)
        })

        let updatedRecordings = [
          ...recordings,
          {
            title: audioTitle,
            duration: getDurationFormatted(status.durationMillis),
            fileUrl: storageFileUrl,
            sound: sound,
            file: getURI,
          },
        ];

        console.log("Status object properties:", status);
        setRecordings(updatedRecordings);
        setRecording(null);
        setAudioTitle("");
        setMessage("Audio saved successfully.");
        Alert.alert("Success", "Audio saved successfully.", [{ text: "OK" }]);
      }

    } catch (error) {

      console.log("Failed to save audio!", error);
      console.error(error);
      setErrorMessage("Failed to save audio!");
      Alert.alert("Error", "Failed to save audio!", [{ text: "OK" }]);
    }
  };



  // update the title of a recording based on its ID in Firebase Storage/Firestore
  const updateAudioTitle = async (id, editTitle) => {
    try {
      // Create the URL for the specific recording document in Firestore
      const firestoreDocumentUrl = `${firestoreBaseUrl}/projects/${projectId}/databases/(default)/documents/${collectionName}/${id}/?currentDocument.exists=true&updateMask.fieldPaths=title&alt=json`;

      // Create the Firestore document data with the updated title
      const firestoreData = {
        fields: {
          title: { stringValue: editTitle },
        },
      };

      // Send a PATCH request to update the title of the recording document
      await axios.patch(firestoreDocumentUrl, firestoreData);

      // Update the local state with the new title
      const updatedRecordings = recordings.map((recording) => {
        if (recording.id === id) {
          return { ...recording, title: editTitle };
        }
        return recording;
      });

      setRecordings(updatedRecordings);

      Alert.alert('Success', 'Audio title updated successfully.', [{ text: 'OK' }]);
      setMessage("Audio title updated")
    } catch (error) {
      console.log(error);
      setErrorMessage("Failed to update the title");
    }
  };



  // Remove a recording from Firebase Storage/Firestore based on its ID.
  const deleteRecording = async (id, audioName) => {
    try {
      // Delete audio from Firestore
      await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recordings/${id}`, {
        method: 'DELETE',
      });

      // Delete audio from Storage
      const userId = "0NL5sTrA7ahzbTJX51xBJWH2Xuh1"
      await fetch(`https://storage.googleapis.com/storage/v1/b/${storageBucket}/o/audio%2F${userId}%2F${audioName}`, {
        method: 'DELETE',
      });

      const updatedRecordings = recordings.filter((recording) => recording.id !== id);
      setRecordings(updatedRecordings);
      Alert.alert("Success", "Audio Deleted...", [{ text: "OK" }]);
      setMessage("Audio deleted successfully")
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to delete audio!", [{ text: "OK" }]);
    }
  };



  //Close the Modal after editing
  const handleClose = () => {
    setModalVisible(false);
  }



  //Log out function
  const handleLogOut = () => {
    signOut(auth)
      .then(() => {
        // Handle successful log out
        navigation.navigate('SignIn')
        console.log("User logged out");
      })
      .catch((error) => {
        // Handle log out error
        console.log(error);
        console.error(error);
        setErrorMessage("Failed to sign out!");
        Alert.alert('Error', 'Failed to sign out!.', [{ text: 'OK' }]);
      });
  };



  // render each recording item in the FlatList component
  const renderItem = ({ item, index }) => {

    const renderEditSection = () => {
      if (editId === item.id) {

        console.log("Edit item id:", item.id);
        return (
          <>
            <Modal visible={modalVisible} animationType="slide" onRequestClose={handleClose}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: 'white', padding: 20 }}>
                  <Text>Change your audio title name here!</Text>
                  <Text style={{ color: 'green' }}>{message}</Text>
                  <Text style={{ color: 'red' }}>{errorMessage}</Text>
                  <TextInput
                    style={styles.inputEdit}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    onBlur={() => updateAudioTitle(item.id, editTitle)}
                  />
                  <TouchableOpacity style={styles.button} onPress={() => updateAudioTitle(item.id, editTitle)}>
                    <Text>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.button} onPress={handleClose}>
                    <Text>Close</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </Modal>
          </>
        );
      } else {
        return null;
      }
    };

    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
        <TouchableOpacity onPress={() => {
          if (item.isPlaying) {
            item.sound.pauseAsync();
          } else {
            item.sound.replayAsync();
          }
        }}>
          <FontAwesomeIcon icon={item.isPlaying ? faPause : faPlay} size={30} color="#000080" />
        </TouchableOpacity>

        <Text>{index + 1} - {item.title} - {item.duration}</Text>

        {renderEditSection()}

        <TouchableOpacity onPress={() => {
          setEditId(item.id);
          setEditTitle(item.title);
          setModalVisible(true);
          console.log("Selected audio id:", item.id);
          console.log("Selected audio title:", item.title);
          console.log("Selected audio index:", index);
        }}>
          <FontAwesomeIcon icon={faEdit} size={30} color='#000080' />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          deleteRecording(item.id, item.title);
          console.log("Audio id:", item.id);
          console.log("Audio title:", item.title);
        }}>
          <FontAwesomeIcon icon={faTrash} size={30} color='#000080' />
        </TouchableOpacity>
      </View>
    );
  };




  return (
    <View style={styles.container}>

      <Text style={styles.heading}>AUDIO RECORDER</Text>

      <Card containerStyle={{ marginTop: 15, marginBottom: 15, height: 300, width: 300, borderRadius: 10, backgroundColor: '#87ceeb', }}>
        <Card.Title>Record an audio here:</Card.Title>
        <Text style={{ color: 'green' }}>{message}</Text>
        <Text style={{ color: 'red' }}>{errorMessage}</Text>
        {recording ? (
          <TouchableOpacity onPress={stopRecording}>
            <FontAwesomeIcon icon={faStop} size={30} color="red" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startRecording}>
            <FontAwesomeIcon icon={faMicrophone} size={30} color="black" />
          </TouchableOpacity>
        )}
        {recording && <Text>Recording...</Text>}
        <TextInput
          style={styles.inputs}
          placeholder="Enter audio name"
          value={audioTitle}
          onChangeText={(text) => setAudioTitle(text)}
        />

        <TouchableOpacity onPress={stopRecording} style={styles.button}>
          <Text>Save Recording</Text>
        </TouchableOpacity>
      </Card>

      <Card containerStyle={{ marginTop: 15, marginBottom: 15, height: 300, width: 300, borderRadius: 10, backgroundColor: '#87ceeb', }}>
        <Card.Title>Recorded audios:</Card.Title>
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      </Card>
      <Button
        title="Log Out"
        onPress={handleLogOut}
        style={{ cursor: 'pointer', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, }}
      />
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#191970',
    width: 400,
  },
  card: {
    marginTop: 15,
    marginBottom: 15,
    height: 350,
    width: 300,
    backgroundColor: '#87ceeb',
    borderRadius: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: '#1e90ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: 140,
    shadowColor: 'black',
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 10,
    marginBottom: 10,
  },
  inputs: {
    width: 250,
    height: 30,
    backgroundColor: '#fffafa',
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    marginTop: 20,
    marginBottom: 20,
  },
  inputEdit: {
    width: 100,
    height: 30,
    backgroundColor: '#fffafa',
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    marginTop: 20,
    marginBottom: 20,
  },
  labels: {
    color: "#FFFFFF",
  },
})
