import React, { Component, ErrorInfo, ReactNode } from 'react';
import Lottie from 'lottie-react';
import { DynamicFrostyAnimation, AnimationType } from './animations/FrostyVectorAnimations';
import { BrandAnimation } from './BrandAnimation';

interface LottiePlayerProps {
  url?: string | any;
  animationData?: any;
  animation?: string | AnimationType;
  type?: string | AnimationType;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

// Helper to recursively unwrap any default module wrapper to get the pure Lottie JSON
const getCleanLottieData = (data: any): any => {
  if (!data) return null;
  if (typeof data === 'object') {
    if ('default' in data && data.default && typeof data.default === 'object') {
      return getCleanLottieData(data.default);
    }
  }
  return data;
};

// Check if string is a known animation key
const isKnownAnimationKey = (key: any): boolean => {
  if (typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return (
    k.includes('cook') ||
    k.includes('chef') ||
    k.includes('prep') ||
    k.includes('bake') ||
    k.includes('scooter') ||
    k.includes('delivery') ||
    k.includes('bike') ||
    k.includes('truck') ||
    k.includes('out_for_delivery') ||
    k.includes('process') ||
    k.includes('pending') ||
    k.includes('confirm') ||
    k.includes('deliver') ||
    k.includes('success') ||
    k.includes('cancel') ||
    k.includes('cart') ||
    k.includes('cake') ||
    k.includes('empty')
  );
};

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class LottieErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Lottie rendering error gracefully intercepted:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * A robust, fail-safe animation player component for Frosty Bite.
 * Seamlessly renders high-performance vector animations with Lottie support.
 */
export const FrostyAnimation: React.FC<LottiePlayerProps> = ({ 
  url, 
  animationData: directAnimationData,
  animation,
  type,
  loop = true, 
  autoplay = true, 
  className,
  style,
  fallback
}) => {
  const targetKey = animation || type || (typeof url === 'string' ? url : null);

  // If the target key is a semantic animation type or matches keywords, render the vector animation directly
  if (targetKey && isKnownAnimationKey(targetKey)) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DynamicFrostyAnimation type={targetKey} className="w-full h-full" />
      </div>
    );
  }

  // If it's a direct JSON object, check if it's a valid Lottie object or fallback
  const rawData = directAnimationData || (typeof url === 'object' ? url : null);
  const cleanData = getCleanLottieData(rawData);

  if (!cleanData && !url) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {fallback || <DynamicFrostyAnimation type="empty_cart" className="w-full h-full" />}
      </div>
    );
  }

  if (cleanData && typeof cleanData === 'object') {
    return (
      <LottieErrorBoundary fallback={
        <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {fallback || <DynamicFrostyAnimation type="empty_cart" className="w-full h-full" />}
        </div>
      }>
        <Lottie 
          animationData={cleanData} 
          loop={loop} 
          autoplay={autoplay} 
          className={className}
          style={style}
        />
      </LottieErrorBoundary>
    );
  }

  // Default to vector animation
  return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {fallback || <DynamicFrostyAnimation type={String(url || 'empty_cart')} className="w-full h-full" />}
    </div>
  );
};

// Aliased for backward compatibility
export const LottiePlayer = FrostyAnimation;
