import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAnonymousSession } from "@/hooks/useAnonymousSession";
import { TrialTimer } from "@/components/auth/TrialTimer";
import { TrialExpiredPrompt } from "@/components/auth/TrialExpiredPrompt";
import { toast } from "@/hooks/use-toast";

interface AIWithTrialProps {
  children: (props: {
    canUseAI: boolean;
    checkAccess: () => Promise<boolean>;
    trialActive: boolean;
    turnsRemaining: number;
  }) => React.ReactNode;
  aiEndpoint: string;
  className?: string;
}

export const AIWithTrial = ({ children, aiEndpoint, className = "" }: AIWithTrialProps) => {
  const { user } = useAuth();
  const { sessionState, checkTrialAccess, transferToUser } = useAnonymousSession();
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [canUseAI, setCanUseAI] = useState(false);
  const [turnsRemaining, setTurnsRemaining] = useState(10);

  // Check access function
  const checkAccess = useCallback(async (): Promise<boolean> => {
    // Authenticated users have high limit (effectively unlimited for normal use)
    if (user) {
      setCanUseAI(true);
      setTurnsRemaining(50);
      return true;
    }

    // Check trial access for anonymous users
    const hasAccess = await checkTrialAccess(aiEndpoint);
    setCanUseAI(hasAccess);
    
    if (!hasAccess) {
      setShowTrialExpired(true);
    }
    
    return hasAccess;
  }, [user, checkTrialAccess, aiEndpoint]);

  // Initial access check
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Handle trial expiration
  const handleTrialExpired = useCallback(() => {
    setCanUseAI(false);
    setShowTrialExpired(true);
    toast({
      title: "Trial Ended",
      description: "Your 3-minute trial has ended. Sign up to continue!",
      variant: "default",
    });
  }, []);

  // Transfer session when user logs in
  useEffect(() => {
    if (user && sessionState?.sessionToken) {
      transferToUser(user.id).then((result) => {
        if (result.success) {
          toast({
            title: "Welcome!",
            description: "Your trial progress has been saved to your account.",
          });
        }
      });
    }
  }, [user, sessionState?.sessionToken, transferToUser]);

  const trialActive = !user && turnsRemaining > 0;

  return (
    <div className={className}>
      {/* AI Component */}
      {children({
        canUseAI,
        checkAccess,
        trialActive: trialActive || false,
        turnsRemaining
      })}

      {/* Trial Expired Prompt */}
      <TrialExpiredPrompt
        isOpen={showTrialExpired}
        onClose={() => setShowTrialExpired(false)}
      />
    </div>
  );
};