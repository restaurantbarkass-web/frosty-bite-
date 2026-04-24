import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { Loader2, AlertCircle } from 'lucide-react';

interface LottiePlayerProps {
  url: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

/**
 * A reusable Lottie player component that loads animations from a URL.
 */
export const LottiePlayer: React.FC<LottiePlayerProps> = ({ 
  url, 
  loop = true, 
  autoplay = true, 
  className,
  style,
  fallback
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    const fetchAnimation = async () => {
      try {
        const response = await fetch(url, {
          referrerPolicy: 'no-referrer',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.status === 403) {
          throw new Error('Access denied (403). The animation provider may be blocking this request.');
        }
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (isMounted) {
          setAnimationData(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Lottie load error for ${url}:`, err);
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchAnimation();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-primary/20" size={24} />
      </div>
    );
  }

  if (error || !animationData) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {fallback || <AlertCircle className="text-primary/20" size={24} />}
      </div>
    );
  }

  return (
    <Lottie 
      animationData={animationData} 
      loop={loop} 
      autoplay={autoplay} 
      className={className}
      style={style}
    />
  );
};

// Example local JSON component (for documentation/code example purposes)
/*
import checkoutSuccess from '../assets/animations/success.json';
export const LocalLottie = () => (
  <Lottie animationData={checkoutSuccess} loop={false} />
);
*/
