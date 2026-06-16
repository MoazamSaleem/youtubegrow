import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Youtube, Sparkles, ArrowLeft, Mail, MessageSquare, Clock, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface SupportChatSession {
  id: string;
  user_id: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface SupportChatMessage {
  id: string;
  session_id: string;
  sender: "user" | "agent" | "system";
  content: string;
  created_at: string;
}

const Contact = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Message sent! We'll get back to you soon.");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setLoading(false);
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Contact Form",
      description: "Use the form below",
      detail: "We'll respond within 24 hours",
    },
    {
      icon: MessageSquare,
      title: "Admin Live Chat",
      description: user ? "Connected in-app" : "Sign in to start chat",
      detail: "Your messages are sent directly to the admin dashboard",
    },
    {
      icon: Clock,
      title: "Response Time",
      description: "Within 24 hours",
      detail: "Usually much faster!",
    },
  ];

  const db = supabase as any;

  const loadOrCreateChatSession = async () => {
    if (!user?.id) {
      setChatSessionId(null);
      setChatMessages([]);
      return;
    }

    setChatLoading(true);

    try {
      const { data: existingSession, error: existingError } = await db
        .from("support_chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      let session: SupportChatSession | null = existingSession;

      if (!session) {
        const { data: createdSession, error: createError } = await db
          .from("support_chat_sessions")
          .insert({ user_id: user.id })
          .select("*")
          .single();

        if (createError) {
          throw createError;
        }

        session = createdSession;
      }

      setChatSessionId(session.id);

      const { data: messagesData, error: messagesError } = await db
        .from("support_chat_messages")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (messagesError) {
        throw messagesError;
      }

      setChatMessages((messagesData || []) as SupportChatMessage[]);
    } catch (error) {
      console.error("Failed to initialize live chat:", error);
      toast.error("Unable to start live chat right now.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!user?.id) {
      toast.error("Please sign in to use live chat.");
      return;
    }

    if (!chatSessionId || !chatInput.trim() || chatSending) return;

    setChatSending(true);
    const content = chatInput.trim();

    try {
      const { error } = await supabase.functions.invoke("send-support-chat-message", {
        body: {
          sessionId: chatSessionId,
          content,
        },
      });

      if (error) {
        throw error;
      }

      setChatInput("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    void loadOrCreateChatSession();
  }, [user?.id]);

  useEffect(() => {
    if (!chatSessionId) return;

    const channel = supabase
      .channel(`support-chat-${chatSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `session_id=eq.${chatSessionId}`,
        },
        (payload) => {
          const message = payload.new as SupportChatMessage;
          setChatMessages((prev) => {
            if (prev.some((item) => item.id === message.id)) return prev;
            return [...prev, message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatSessionId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Youtube className="h-8 w-8 text-primary" />
              <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
            </div>
            <span className="font-display font-bold text-base sm:text-xl leading-tight">
              YouTube <span className="gradient-text">Growth Planner</span>
            </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {contactInfo.map((info, index) => (
              <motion.div
                key={info.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <info.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{info.title}</h3>
                <p className="text-primary font-medium mb-1">{info.description}</p>
                <p className="text-xs text-muted-foreground">{info.detail}</p>
              </motion.div>
            ))}
          </div>

          {/* Contact Form */}
          <div className="glass rounded-xl p-8 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-center">Send Us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us more about your inquiry..."
                  rows={5}
                  required
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Live Chat */}
          <div className="glass rounded-xl p-8 max-w-2xl mx-auto mt-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-center">Live Chat</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Messages sent here go directly to admins for review and reply.
            </p>

            {!user ? (
              <div className="text-center space-y-3">
                <p className="text-muted-foreground">
                  Sign in to start a live chat conversation with support.
                </p>
                <Link to="/signin">
                  <Button variant="hero">Sign In to Chat</Button>
                </Link>
              </div>
            ) : (
              <>
                <div
                  ref={scrollContainerRef}
                  className="h-72 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-4 space-y-3"
                >
                  {chatLoading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading chat...
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center">
                      Start the conversation. Our team will reply here.
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isUser = msg.sender === "user";
                      return (
                        <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                            <p>{msg.content}</p>
                            <p className={`mt-1 text-[11px] ${isUser ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSendChatMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={chatLoading || chatSending || !chatSessionId}
                  />
                  <Button
                    onClick={() => void handleSendChatMessage()}
                    disabled={chatLoading || chatSending || !chatInput.trim() || !chatSessionId}
                  >
                    {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact;
