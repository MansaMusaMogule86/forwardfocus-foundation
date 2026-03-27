import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Users, Shield, CheckCircle, Target, Brain, MessageSquare, BookOpen, Home, Phone, ArrowRight, Star, Calendar, Award, Linkedin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ContactForm from "@/components/forms/ContactForm";
import AskCoachKay from "@/components/ui/AskCoachKay";
import { CoachKaySection } from "@/components/home/CoachKaySection";
import FounderOnePager from "@/components/about/FounderOnePager";
import { SEOHead } from "@/components/seo/SEOHead";
import { StructuredData } from "@/components/seo/StructuredData";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SITE_CONFIG } from "@/config/site";

// Import images
import coachKayProfessional from "@/assets/coach-kay-professional.jpg";
import diverseCommunityMeeting from "@/assets/diverse-community-meeting.jpg";

export default function AboutUs() {
  const [showConsultation, setShowConsultation] = useState(false);
  return <>
      <SEOHead
        title="About Our Mission | Accredited AI Life Transformation Coaching"
        description="Meet Coach Kay, an Accredited AI Life Transformation Coach and Master Certified expert. We provide trauma-informed support and AI-driven second chances."
        path="/about"
        image="/images/og-about.jpg"
        imageAlt="Diverse community gathered together for transformation coaching"
      />
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_CONFIG.name,
          url: SITE_CONFIG.baseUrl,
          description: SITE_CONFIG.description,
          areaServed: "Ohio",
          serviceType: ["Healing Hub", "The Collective", "Focus Flow Elevation Hub", "AI & Life Transformation", "Trauma Recovery Support"]
        }}
      />
      <BreadcrumbSchema crumbs={[{ name: 'About Us', path: '/about' }]} />
      <main id="main" className="bg-cream/30">
      {/* Hero Section */}
      <header className="relative bg-gradient-osu-primary text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/90 via-osu-scarlet/80 to-osu-scarlet-dark/70"></div>
        <div className="relative container py-24 md:py-32 flex items-center justify-center text-center">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="font-heading text-5xl md:text-7xl font-bold mb-8 leading-tight">
              About Forward Focus Elevation
            </h1>
            <p className="text-lg md:text-xl mb-12 text-white/90 leading-relaxed max-w-3xl mx-auto">Real Healing. Smart Tools. Second Chances for Every Story. AI-powered transformation for justice-impacted individuals and families because your next chapter deserves more than survival.</p>
            <div className="flex items-center justify-center gap-6 text-sm mb-12 flex-wrap">
              <span className="flex items-center gap-2 bg-osu-scarlet/20 backdrop-blur-sm border border-osu-scarlet/30 px-6 py-3 rounded-full text-white">
                <Shield className="h-5 w-5" />
                Dignity
              </span>
              <span className="flex items-center gap-2 bg-osu-gray/20 backdrop-blur-sm border border-osu-gray/30 px-6 py-3 rounded-full text-white">
                <Heart className="h-5 w-5" />
                Hope
              </span>
              <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 px-6 py-3 rounded-full text-white">
                <Users className="h-5 w-5" />
                Community
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg justify-center mx-auto">
              <Button asChild size="lg" className="get-involved-gold-button border-none flex-1 shadow-xl">
                <Link to="/victim-services">
                  <Shield className="h-5 w-5 mr-2" />
                  Healing Hub
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-osu-gray hover:bg-osu-gray-dark text-white flex-1 shadow-xl border-none">
                <Link to="/learn">
                  <Users className="h-5 w-5 mr-2" />
                  The Collective
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-24 space-y-32">
        {/* Our Story & Vision Combined */}
        <section aria-labelledby="story" className="scroll-mt-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 id="story" className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-8">
                  Our Story
                </h2>
                <div className="space-y-8 text-foreground">
                  <p className="text-xl leading-relaxed">Forward Focus Elevation was born from the intersection of lived experience and accredited expertise. We saw firsthand how hard it is for justice-impacted families to access real support when traditional systems are fragmented and outdated.</p>
                  <p className="text-xl leading-relaxed">
                    So, we built something different — a trauma-informed, AI-powered platform led by an **Accredited AI Consultant and Master Certified Transformation Coach**. A community designed not just to provide resources, but to scale human empowerment through technology.
                  </p>
                  <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-8 rounded-2xl border-l-4 border-primary">
                    <p className="text-lg font-semibold text-foreground mb-4">Forward is the Only Direction</p>
                    <p className="text-foreground/80 leading-relaxed">
                      We see a future where every justice-impacted person and family has access to the tools, people, and opportunities needed to thrive no matter where they are or what challenges they face. Forward Focus Elevation is more than an organization — it's a digital space, a community, and a movement of people who believe in second chances and lasting change.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <img src={diverseCommunityMeeting} alt="Diverse community members in supportive meeting environment" className="w-full h-80 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-accent/90 to-transparent flex items-end">
                  <div className="p-8 text-accent-foreground w-full text-center">
                    <p className="text-2xl font-semibold">
                      Built by community, for community
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CoachKaySection />

        {/* Our Values & Mission */}
        <section aria-labelledby="values" className="scroll-mt-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 id="values" className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-8">
                Our Values & Mission
              </h2>
              <p className="text-xl text-foreground/70 leading-relaxed max-w-3xl mx-auto">
                Everything we do is guided by these core principles that shape our community and platform.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <Card className="text-center p-8 border border-osu-gray/10 bg-white/40 backdrop-blur-md hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-16 h-16 bg-osu-scarlet/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-osu-scarlet" />
                  </div>
                  <CardTitle className="text-2xl font-heading">Dignity First</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70 leading-relaxed">
                    Every person deserves respect, compassion, and the opportunity to rebuild their life with dignity intact.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center p-8 border border-osu-gray/10 bg-white/40 backdrop-blur-md hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-16 h-16 bg-osu-gray/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="h-8 w-8 text-osu-gray" />
                  </div>
                  <CardTitle className="text-2xl font-heading">Hope-Centered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70 leading-relaxed">
                    We believe in the power of hope to transform lives and create lasting positive change for families.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center p-8 border border-osu-gray/10 bg-white/40 backdrop-blur-md hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-16 h-16 bg-white/20 border border-white/30 shadow-inner rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-foreground" />
                  </div>
                  <CardTitle className="text-2xl font-heading">Community Power</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70 leading-relaxed">
                    Real change happens when people come together, support each other, and build something bigger than themselves.
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="bg-gradient-to-br from-osu-scarlet/5 to-osu-gray/5 rounded-2xl p-12 text-center border border-osu-gray/10 shadow-inner">
              <h3 className="text-3xl font-heading font-bold text-foreground mb-6">Our Mission</h3>
              <p className="text-xl text-foreground/80 leading-relaxed max-w-4xl mx-auto font-light">
                To create a trauma-informed, AI-powered ecosystem where justice-impacted individuals and families 
                can access the tools, community, and support they need to not just survive, but thrive. We're building 
                a future where everyone has the opportunity to write their next chapter with hope and dignity.
              </p>
            </div>

            {/* Accredited Social Impact Section */}
            <div className="mt-16 bg-white/40 backdrop-blur-md rounded-2xl p-8 border border-osu-scarlet/10 flex flex-col md:flex-row items-center gap-8 shadow-sm">
              <div className="p-4 bg-osu-scarlet/10 rounded-full">
                <Award className="h-12 w-12 text-osu-scarlet" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-xl font-bold text-foreground mb-2">Accredited Social Impact</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Our platform is built on evidence-based methodologies. With Master Certifications in Mindfulness, Life Purpose, and Transformation, we provide more than just "help"—we provide a structured, accredited pathway to emotional and professional stability.
                </p>
              </div>
            </div>

            {/* What Makes Us Different */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-secondary/5 py-8 md:py-16 px-4 md:px-8 rounded-2xl overflow-hidden">
              <div className="bg-background rounded-xl p-6 md:p-8 border shadow-lg hover:shadow-xl transition-all overflow-hidden">
                <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary rounded-xl flex items-center justify-center shadow-md">
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-secondary-foreground" />
                  </div>
                  <h3 className="text-lg md:text-2xl font-semibold text-foreground">
                    Built for Diverse Communities
                  </h3>
                </div>
                <p className="text-foreground/70 text-base md:text-lg leading-relaxed">
                  Accessible, inclusive, and designed for real life. We understand that every 
                  journey is unique and every person deserves dignity and respect.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 md:p-8 border shadow-lg hover:shadow-xl transition-all overflow-hidden">
                <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-primary rounded-xl flex items-center justify-center shadow-md">
                    <Target className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg md:text-2xl font-semibold text-foreground">
                    Interactive Tools That Create Action
                  </h3>
                </div>
                <p className="text-foreground/70 text-base md:text-lg leading-relaxed">
                  Move beyond just reading information. Our platform helps you take concrete 
                  steps toward your goals with personalized guidance and real-world resources.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Printable One-Pager Section */}
        <section className="scroll-mt-16 py-16 bg-white/50 border-y border-osu-gray/5">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="font-heading text-3xl font-bold text-foreground mb-4">The FFE Vision One-Pager</h2>
            <p className="text-muted-foreground mb-8">Download or print a summary of our mission and Coach Kay's accredited expert profile.</p>

            <div className="mb-8 transform scale-[0.8] md:scale-100 origin-top">
              <FounderOnePager />
            </div>

            <Button
              onClick={() => window.print()}
              size="lg"
              className="get-involved-gold-button border-none px-8"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Download Expert Profile
            </Button>
          </div>
        </section>

        {/* Contact Section */}
        <section className="scroll-mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-8">
              Ready to Connect?
            </h2>
            <p className="text-xl text-foreground/70 mb-12 leading-relaxed">
              Whether you have questions, need support, or want to get involved — we're here for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <Button asChild size="lg" className="get-involved-gold-button border-none flex-1 shadow-xl">
                <Link to="/victim-services">
                  <Shield className="h-5 w-5 mr-2" />
                  Explore the Healing Hub
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="flex-1 shadow-xl">
                <Link to="/learn">
                  <Users className="h-5 w-5 mr-2" />
                  Access The Collective
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  </>;
}