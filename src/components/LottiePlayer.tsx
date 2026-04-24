import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

interface LottiePlayerProps {
  url: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A reusable Lottie player component that loads animations from a URL.
 */
export const LottiePlayer: React.FC<LottiePlayerProps> = ({ 
  url, 
  loop = true, 
  autoplay = true, 
  className,
  style 
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAnimation = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch animation');
        const data = await response.json();
        if (isMounted) {
          setAnimationData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          console.error('Lottie load error:', err);
        }
      }
    };

    fetchAnimation();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (error) {
    return <div className="text-xs text-red-500">Animation failed to load</div>;
  }

  if (!animationData) {
    return <div className="animate-pulse bg-white/5 rounded-full w-full h-full" />;
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
