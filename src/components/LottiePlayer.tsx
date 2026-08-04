import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { Loader2, AlertCircle } from 'lucide-react';
import { BrandAnimation } from './BrandAnimation';

interface LottiePlayerProps {
  url?: string | any;
  animationData?: any;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

/**
 * A reusable animation player component for Frosty Bite.
 */
export const FrostyAnimation: React.FC<LottiePlayerProps> = ({ 
  url, 
  animationData: directAnimationData,
  loop = true, 
  autoplay = true, 
  className,
  style,
  fallback
}) => {
  const [animationData, setAnimationData] = useState<any>(directAnimationData || (typeof url === 'object' ? url : null));
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!directAnimationData && typeof url === 'string');

  useEffect(() => {
    const rawData = directAnimationData || url;
    if (!rawData) {
      setLoading(false);
      setError(true);
      return;
    }

    if (typeof rawData === 'object') {
      setAnimationData(rawData);
      setLoading(false);
      setError(false);
      return;
    }

    if (typeof rawData !== 'string') {
      setError(true);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    const fetchAnimation = async () => {
      try {
        const response = await fetch(rawData, {
          referrerPolicy: 'no-referrer',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        // If it's a generic logo, quietly switch to our custom brand fallback
        if (data?.layers?.[0]?.nm === 'MASTER' && data?.layers?.[1]?.nm?.includes('S5-Y')) {
           setError(true);
           setLoading(false);
           return;
        }

        if (isMounted) {
          setAnimationData(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchAnimation();

    return () => {
      isMounted = false;
    };
  }, [url, directAnimationData]);

  if (loading) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BrandAnimation size="sm" className="scale-50 opacity-20" />
      </div>
    );
  }

  if (error || !animationData) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {fallback || <BrandAnimation size="sm" className="scale-75 opacity-50" />}
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

// Aliased for backward compatibility if needed
export const LottiePlayer = FrostyAnimation;

// Example local JSON component (for documentation/code example purposes)
/*
import checkoutSuccess from '../assets/animations/success.json';
export const LocalLottie = () => (
  <Lottie animationData={checkoutSuccess} loop={false} />
);
*/
