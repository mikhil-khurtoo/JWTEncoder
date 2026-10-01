"use strict";

const $ = (id) => document.getElementById(id);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const CSV_HEADERS = [
    "timestamp_utc",
    "raw_data",
    "encoded_jwt",
    "private_key",
    "public_key"
];

let fileHandle = null;
let fileName = "";
let fileText = "";

/*
 * Display a success or error message.
 */
function showMessage(element, text, type) {
    element.textContent = text;
    element.className = "msg show " + type;
}

/*
 * Clear a message.
 */
function clearMessage(element) {
    element.textContent = "";
    element.className = "msg";
}

/*
 * Convert bytes into standard Base64.
 */
function bytesToBase64(bytes) {
    let binaryText = "";
    const chunkSize = 32768;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binaryText += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
        );
    }

    return btoa(binaryText);
}

/*
 * Convert standard Base64 into bytes.
 */
function base64ToBytes(value) {
    return Uint8Array.from(
        atob(value),
        (character) => character.charCodeAt(0)
    );
}

/*
 * Convert bytes into Base64URL.
 */
function bytesToBase64Url(bytes) {
    return bytesToBase64(bytes)
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

/*
 * Encode ordinary text as Base64URL.
 */
function encodeText(value) {
    return bytesToBase64Url(
        textEncoder.encode(value)
    );
}

/*
 * Decode Base64URL into bytes.
 */
function decodeBase64Url(value) {
    value = value
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    value += "=".repeat(
        (4 - (value.length % 4)) % 4
    );

    return base64ToBytes(value);
}

/*
 * Remove the PEM header, footer and spaces.
 * Return the key as an ArrayBuffer.
 */
function pemToArrayBuffer(pem) {
    const base64Key = pem
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s/g, "");

    if (!base64Key) {
        throw new Error("The PEM key is empty or invalid.");
    }

    return base64ToBytes(base64Key).buffer;
}

/*
 * Convert an ArrayBuffer into PEM format.
 */
function arrayBufferToPem(buffer, label) {
    const base64Key = bytesToBase64(
        new Uint8Array(buffer)
    );

    const lines = base64Key
        .match(/.{1,64}/g)
        .join("\n");

    return (
        `-----BEGIN ${label}-----\n` +
        `${lines}\n` +
        `-----END ${label}-----`
    );
}

/*
 * Escape a value so that it can safely be stored in CSV.
 */
function escapeCsvValue(value) {
    return (
        '"' +
        String(value ?? "").replace(/"/g, '""') +
        '"'
    );
}

/*
 * Convert the input into a JWT payload object.
 *
 * If valid JSON is entered, the JSON is used.
 * If ordinary text is entered, it is stored in a data field.
 