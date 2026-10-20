import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { useState } from 'react';
import { answerAssistant } from '../../features/booking/bookingService';
import { askChatbot } from '../../features/chat/chatClient';

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Bonjour. Je peux vous aider à trouver un trajet.' }]);
  const [loading, setLoading] = useState(false);
  const sendMessage = async (event) => {
    event.preventDefault();
    const current = message.trim();
    if (!current || loading) return;
    const nextMessages = [...messages, { from: 'user', text: current }];
    setMessages(nextMessages);
    setMessage('');
    setLoading(true);
    try {
      const answer = await askChatbot(nextMessages.filter((item) => item.from !== 'bot' || item.text !== 'Bonjour. Je peux vous aider à trouver un trajet.').map((item) => ({ role: item.from === 'user' ? 'user' : 'assistant', content: item.text })));
      setMessages((items) => [...items, { from: 'bot', text: answer }]);
    } catch {
      setMessages((items) => [...items, { from: 'bot', text: answerAssistant(current) }]);
    } finally {
      setLoading(false);
    }
  };
  return <div className={`chatbot ${open ? 'open' : ''}`}><button className="chat-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Fermer l’aide' : 'Ouvrir l’aide'}>{open ? <X size={18} /> : <MessageCircle size={20} />}<span>Aide</span></button>{open && <div className="chat-panel"><div className="chat-header"><div className="chat-bot-icon"><Bot size={17} /></div><div><strong>Aide trajet</strong><small>Horaires, prix et réservation</small></div><button onClick={() => setOpen(false)} aria-label="Fermer"><X size={15} /></button></div><div className="chat-messages">{messages.map((item, index) => <div key={index} className={`chat-message ${item.from}`}>{item.text}</div>)}{loading && <div className="chat-message bot">Je réfléchis…</div>}</div><form className="chat-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Écrire une question" disabled={loading} /><button aria-label="Envoyer" disabled={loading}><Send size={15} /></button></form></div>}</div>;
}
