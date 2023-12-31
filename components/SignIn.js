
import React, { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Text, View, TextInput, Alert, Button, StyleSheet, TouchableOpacity } from "react-native";
import { Card } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";

const apiKey = "AIzaSyBVxolW1kr1EUIk-j02yRX_wN4844N2JtY";

const SignIn = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigation = useNavigation();

    const handleSignin = (async () => {

        const endPoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
        const userInfo = {
            email,
            password,

            returnSecureToken: true
        }

        try {

            const response = await fetch(endPoint, {
                method: "POST", headers: {
                    "Content-type": "application/json"
                }, body: JSON.stringify(userInfo)
            })

            Alert.alert("Success", "Signed In Successfully.", [{ text: "OK" }]);
            navigation.navigate("Home"); // Navigate to the AudioRecorder screen
            console.log("Logged in successfully");

        } catch (error) {
            // Handle signin error
            Alert.alert("Error", "Failed to sign in. Invalid Username/Password!", [{ text: "OK" }]);
            setMessage("Failed to sign in. Invalid Username/Password!")
            console.log(error);
        }

    })

    const handleLinkClick = () => {
        navigation.navigate('Register');
    };



    return (

        <View style={styles.container}>

            <Card style={styles.card}>
                <Card.Title title="Sign In Page" subtitle="Enter your credentials to sign in!" />
                <Card.Content>
                    <Text style={{ color: 'red' }}>{message}</Text>
                    <TextInput
                        placeholder="Username/Email"
                        value={email}
                        onChangeText={setEmail}
                        style={styles.inputs}
                    />
                    <TextInput
                        placeholder="Password"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        style={styles.inputs}
                    />
                </Card.Content>

                <Card.Actions>
                    <TouchableOpacity onPress={handleSignin} style={styles.button}>
                        <Text>Sign In</Text>
                    </TouchableOpacity>
                </Card.Actions>

                <Card.Actions>
                    <TouchableOpacity style={styles.nav_link} onPress={handleLinkClick}>
                        <Text>No account? Sign Up Now </Text>
                    </TouchableOpacity>
                </Card.Actions>


                <Card.Actions>
                    <TouchableOpacity style={styles.nav_link} onPress={handleLinkClick}>
                        <Text>Forgot Password?</Text>
                    </TouchableOpacity>
                </Card.Actions>
            </Card>

        </View>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        marginTop: 15,
        marginBottom: 15,
        height: 500,
        width: 300,
        backgroundColor: '#87ceeb',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heading: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
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
        borderRadius: 20,
        width: 150,
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    nav_link: {
        backgroundColor: '#87ceeb',
        paddingHorizontal: 5,
        width: 200,
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
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
});

export default SignIn;