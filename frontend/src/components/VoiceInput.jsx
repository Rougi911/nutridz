import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';

export default function VoiceInput({
  context = 'food',
  onResult,
  onError,
  buttonStyle = {},
  showTranscript = true,
}) {
  const { t, lang } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef('');
  const onResultRef    = useRef(onResult);
  const onErrorRef     = useRef(onError);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current  = onError;  }, [onError]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.lang = lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'fr-FR';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final   = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += piece;
        } else {
          interim += piece;
        }
      }
      const current = final || interim;
      setTranscript(current);
      transcriptRef.current = current;
      if (final) recognition.stop();
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        toast.error(t('voice.noSpeech'));
      } else if (event.error === 'not-allowed') {
        toast.error(t('voice.notAllowed'));
      } else {
        toast.error(t('voice.error'));
      }
      if (onErrorRef.current) onErrorRef.current(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcriptRef.current.trim() && onResultRef.current) {
        onResultRef.current(transcriptRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [lang, t]);

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      toast.error(t('voice.startError'));
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  if (!supported) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        {t('voice.notSupported')}
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        style={{
          padding: '0.6rem 1rem',
          borderRadius: 'var(--radius-xs)',
          border: 'none',
          background: isListening ? 'var(--accent-red)' : 'var(--accent-blue)',
          color: 'white',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          ...buttonStyle,
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>{isListening ? '⏹️' : '🎤'}</span>
        <span>{isListening ? t('voice.stop') : t('voice.start')}</span>
      </button>

      {showTranscript && transcript && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-2xs)',
          fontSize: '0.9rem',
          fontStyle: 'italic',
        }}>
          "{transcript}"
        </div>
      )}
    </div>
  );
}
