import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Bot, User, RotateCcw, Mail, Calendar, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmailChatHistoryModal from "@/components/ai/EmailChatHistoryModal";
import { useToast } from "@/hooks/use-toast";
import { useCalendlyPopup } from "@/hooks/useCalendlyPopup";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}
const MAX_MESSAGE_LENGTH = 4000;

const AskCoachKay = () => {
  const [messages, setMessages] = useState<Message[]>([{
    id: '1',
    type: 'ai',
    content: "Hi, I'm Coach Kay. I'm here to listen, guide, and support you—whether you need emotional support, want to explore our programs, get resources, or book a free consult. What's going on today?",
    timestamp: new Date()
  }]);
  const [inputMessage, setInputMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [showNudge, setShowNudge] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { openCalendly, calendlyReady } = useCalendlyPopup();

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewChat = () => {
    setMessages([{
      id: '1',
      type: 'ai',
      content: "Hi, I'm Coach Kay. I'm here to listen, guide, and support you—whether you need emotional support, want to explore our programs, get resources, or book a free consult. What's going on today?",
      timestamp: new Date()
    }]);
    toast({
      title: "New conversation started",
      description: "Chat history cleared. How can I help you today?"
    });
  };

  const handleOpenCalendly = () => {
    if (calendlyReady) {
      openCalendly('https://calendly.com/ffe_coach_kay/free-call');
    }
  };

  const sendMessage = async (chatMessages: { role: string; content: string }[]) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Ask Coach Kay is temporarily unavailable. Please try again later.');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/coach-k`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ messages: chatMessages })
      });

      if (response.status === 429) {
        setTrialExpired(true);
        const data = await response.json();
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.type === 'ai') {
            lastMessage.content = data.response || "You've reached your message limit. Sign up for unlimited access!";
          }
          return newMessages;
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const content = data.response || '';

      // Track remaining for soft nudge
      if (data.remaining !== undefined && data.remaining <= 3 && data.remaining > 0) {
        setShowNudge(true);
      }

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.type === 'ai') {
          lastMessage.content = content;
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Coach Kay error:', error);
      const errorContent = error instanceof Error && error.message
        ? `I'm having trouble connecting right now. ${error.message}. Please try again in a moment, or book a free consult directly at https://calendly.com/ffe_coach_kay/free-call`
        : "I'm having trouble connecting right now. Please try again in a moment, or book a free consult directly at https://calendly.com/ffe_coach_kay/free-call";
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.type === 'ai') {
          lastMessage.content = errorContent;
        }
        return newMessages;
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || trialExpired) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    const userInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);
    setGuestMessageCount(prev => prev + 1);

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, aiMessage]);

    const chatMessages = messages.map(msg => ({
      role: msg.type === 'ai' ? 'assistant' : 'user',
      content: msg.content
    }));
    chatMessages.push({ role: 'user', content: userInput });

    await sendMessage(chatMessages);
    setIsLoading(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <MessageCircle className="h-5 w-5 mr-2" />
            Connect with Coach Kay
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Ask Coach Kay
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={!calendlyReady} onClick={handleOpenCalendly} className="text-xs">
                  <Calendar className="h-4 w-4 mr-1" />
                  {calendlyReady ? 'Book Free Call' : 'Loading...'}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowEmailModal(true)} className="text-xs">
                  <Mail className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={startNewChat} className="text-xs">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogDescription className="sr-only">Ask Coach Kay for personalized reentry guidance and resources.</DialogDescription>
          </DialogHeader>

          {/* Disclaimer */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 px-4 py-3 mx-6">
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Important:</strong> This AI provides guidance and resources, not professional counseling or emergency services. If you're in crisis, call <strong>988</strong> or <strong>911</strong>.
            </p>
          </div>

          {/* Soft nudge banner */}
          {showNudge && !trialExpired && (
            <div className="bg-primary/10 border border-primary/20 px-4 py-2 mx-6 rounded-lg">
              <p className="text-xs text-primary">
                💡 You're getting close to the free limit. <a href="/register" className="underline font-semibold">Sign up</a> for unlimited access!
              </p>
            </div>
          )}

          {/* Trial expired banner */}
          {trialExpired && (
            <div className="bg-destructive/10 border border-destructive/20 px-4 py-3 mx-6 rounded-lg text-center">
              <p className="text-sm font-semibold text-destructive mb-2">Free messages used up</p>
              <p className="text-xs text-muted-foreground mb-3">Sign up to continue chatting with Coach Kay — it's free!</p>
              <Button asChild size="sm" className="bg-primary text-primary-foreground">
                <a href="/register">Create Free Account</a>
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <ScrollArea className="h-96 pr-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map(message => (
                  <div key={message.id} className={`flex gap-2 ${message.type === 'ai' ? 'justify-start' : 'justify-end'}`}>
                    {message.type === 'ai' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${message.type === 'ai' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                      {message.content}
                    </div>
                    {message.type === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  placeholder={trialExpired ? "Sign up to continue chatting..." : "What's going on today? How can I help?"}
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                  disabled={isLoading || trialExpired}
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <Button onClick={handleSendMessage} size="icon" disabled={isLoading || trialExpired}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {inputMessage.length} / {MAX_MESSAGE_LENGTH}
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              💙 Emotional Support • 🗺️ Site Navigation • 📋 Programs • 🔍 Resources • 📅 Coaching Consults
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmailChatHistoryModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} messages={messages} coachName="Coach Kay" />
    </>
  );
};

export default AskCoachKay;