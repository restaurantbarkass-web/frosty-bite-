import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export type AnimationType = 
  | 'empty_cart' 
  | 'cake' 
  | 'chef_cooking' 
  | 'cooking' 
  | 'preparing'
  | 'delivery_scooter' 
  | 'out_for_delivery'
  | 'order_processing' 
  | 'processing' 
  | 'pending'
  | 'order_confirmed' 
  | 'confirmed'
  | 'order_delivered' 
  | 'delivered' 
  | 'success_check'
  | 'order_cancelled' 
  | 'cancelled';

/**
 * 1. Empty Cart / Bakery Treat Box Animation
 */
export const EmptyCartAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      {/* Background Soft Ambient Radial Glow */}
      <motion.div
        animate={{
          scale: [0.9, 1.15, 0.9],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-48 h-48 rounded-full bg-gradient-to-tr from-primary/30 to-amber-500/20 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 320 320"
        className="w-full h-full max-w-xs drop-shadow-[0_10px_25px_rgba(249,115,22,0.2)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Floating Sparkles & Crumbs */}
        {[
          { x: 70, y: 80, delay: 0, s: 0.8 },
          { x: 250, y: 70, delay: 0.8, s: 1 },
          { x: 60, y: 190, delay: 1.4, s: 0.6 },
          { x: 260, y: 180, delay: 0.4, s: 0.9 },
          { x: 160, y: 40, delay: 1.1, s: 1.2 },
        ].map((spark, idx) => (
          <motion.g
            key={idx}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 0.9, 0],
              scale: [0, spark.s, 0],
              y: [-5, -25],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              delay: spark.delay,
              ease: "easeInOut",
            }}
          >
            <path
              d={`M${spark.x} ${spark.y - 8} Q${spark.x} ${spark.y} ${spark.x + 8} ${spark.y} Q${spark.x} ${spark.y} ${spark.x} ${spark.y + 8} Q${spark.x} ${spark.y} ${spark.x - 8} ${spark.y} Q${spark.x} ${spark.y} ${spark.x} ${spark.y - 8} Z`}
              fill="#F59E0B"
            />
          </motion.g>
        ))}

        {/* Soft shadow below the box */}
        <motion.ellipse
          cx="160"
          cy="265"
          rx="75"
          ry="14"
          fill="rgba(0,0,0,0.4)"
          animate={{
            rx: [70, 85, 70],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* The Bakery Shopping Box / Bag Body */}
        <motion.g
          animate={{
            y: [-3, 3, -3],
            rotate: [-1, 1, -1],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Main Box Outer */}
          <path
            d="M80 145 L95 245 C97 255 105 260 115 260 L205 260 C215 260 223 255 225 245 L240 145 Z"
            fill="#1E1E24"
            stroke="#F97316"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Box Inner Lip & Depth Shadow */}
          <path
            d="M80 145 Q160 170 240 145 Q160 120 80 145 Z"
            fill="#121217"
            stroke="#F97316"
            strokeWidth="3"
          />

          {/* Front Logo / Frosty Emblem Badge on Box */}
          <rect
            x="130"
            y="180"
            width="60"
            height="40"
            rx="10"
            fill="#27272A"
            stroke="#F59E0B"
            strokeWidth="2"
          />
          <text
            x="160"
            y="204"
            textAnchor="middle"
            fill="#F97316"
            fontSize="11"
            fontWeight="900"
            fontStyle="italic"
            letterSpacing="0.05em"
          >
            FROSTY
          </text>
          <text
            x="160"
            y="215"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="8"
            fontWeight="800"
            letterSpacing="0.1em"
          >
            BAKERY
          </text>

          {/* Box Handles */}
          <path
            d="M120 140 C120 95 200 95 200 140"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />

          {/* Floating Sweet Cupcake Emerging with Joy */}
          <motion.g
            animate={{
              y: [-12, 4, -12],
              rotate: [-4, 4, -4],
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Cupcake Liner */}
            <path
              d="M132 135 L138 165 C139 170 144 174 150 174 L170 174 C176 174 181 170 182 165 L188 135 Z"
              fill="#F97316"
              stroke="#EA580C"
              strokeWidth="2"
            />
            {/* Liner Ridges */}
            <line x1="145" y1="137" x2="149" y2="172" stroke="#C2410C" strokeWidth="1.5" />
            <line x1="160" y1="137" x2="160" y2="173" stroke="#C2410C" strokeWidth="1.5" />
            <line x1="175" y1="137" x2="171" y2="172" stroke="#C2410C" strokeWidth="1.5" />

            {/* Frosting Swirl */}
            <path
              d="M125 135 C125 120 140 115 150 118 C155 105 170 105 175 116 C188 116 195 125 195 135 C190 142 130 142 125 135 Z"
              fill="#FDE68A"
              stroke="#F59E0B"
              strokeWidth="2"
            />
            <path
              d="M140 118 C145 98 175 98 180 116"
              fill="#FEF3C7"
            />

            {/* Cherry on Top */}
            <motion.circle
              cx="160"
              cy="96"
              r="9"
              fill="#EF4444"
              stroke="#B91C1C"
              strokeWidth="1.5"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <path
              d="M162 90 C166 80 175 78 178 80"
              stroke="#15803D"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Glowing Sprinkles */}
            <circle cx="142" cy="126" r="2" fill="#3B82F6" />
            <circle cx="156" cy="122" r="2.5" fill="#EF4444" />
            <circle cx="172" cy="127" r="2" fill="#10B981" />
            <circle cx="163" cy="133" r="2" fill="#EC4899" />
          </motion.g>

          {/* Steaming Sweet Aromas Drifting Up */}
          {[
            { d: "M140 100 Q130 70 145 45", delay: 0 },
            { d: "M160 85 Q175 60 160 35", delay: 0.5 },
            { d: "M180 95 Q190 70 178 48", delay: 1.0 },
          ].map((steam, sIdx) => (
            <motion.path
              key={sIdx}
              d={steam.d}
              fill="none"
              stroke="#FDBA74"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="12 12"
              initial={{ pathOffset: 0, opacity: 0 }}
              animate={{
                pathOffset: [0, 1],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: steam.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.g>
      </svg>
    </div>
  );
};

/**
 * 2. Chef Baking / Preparing Animation
 */
export const ChefCookingAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      <motion.div
        animate={{
          scale: [0.95, 1.15, 0.95],
          opacity: [0.2, 0.45, 0.2],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-52 h-52 rounded-full bg-gradient-to-tr from-amber-600/30 to-primary/30 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 320 320"
        className="w-full h-full max-w-xs drop-shadow-[0_12px_28px_rgba(249,115,22,0.25)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft shadow */}
        <ellipse cx="160" cy="275" rx="80" ry="12" fill="rgba(0,0,0,0.5)" />

        {/* Warm Oven & Stove Top */}
        <rect x="85" y="220" width="150" height="50" rx="14" fill="#18181B" stroke="#27272A" strokeWidth="3" />
        <line x1="100" y1="245" x2="220" y2="245" stroke="#3F3F46" strokeWidth="2" />
        <circle cx="115" cy="233" r="4" fill="#EF4444" className="animate-pulse" />
        <circle cx="130" cy="233" r="4" fill="#F59E0B" />
        <circle cx="205" cy="233" r="4" fill="#10B981" />

        {/* Animated Burner Flame */}
        <motion.g
          animate={{
            scaleY: [1, 1.25, 0.9, 1.2, 1],
            scaleX: [1, 0.95, 1.05, 0.9, 1],
          }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "160px 220px" }}
        >
          <path d="M140 220 C145 205 155 195 160 190 C165 195 175 205 180 220 Z" fill="#F97316" />
          <path d="M148 220 C152 210 158 202 160 200 C162 202 168 210 172 220 Z" fill="#FDE047" />
        </motion.g>

        {/* Sizzling Frying Pan & Baked Delicacy */}
        <motion.g
          animate={{
            rotate: [-4, 6, -3, 0],
            y: [-3, -8, 0, -3],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "160px 185px" }}
        >
          {/* Pan Handle */}
          <rect x="50" y="180" width="60" height="12" rx="6" fill="#3F3F46" stroke="#27272A" strokeWidth="2" />
          {/* Pan Base */}
          <ellipse cx="160" cy="188" rx="65" ry="18" fill="#27272A" stroke="#52525B" strokeWidth="3" />
          <ellipse cx="160" cy="186" rx="55" ry="13" fill="#18181B" />

          {/* Sizzling Treat in Pan */}
          <motion.g
            animate={{
              y: [-1, -12, 0],
              rotate: [0, -15, 0],
            }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "160px 182px" }}
          >
            <ellipse cx="160" cy="180" rx="32" ry="11" fill="#EA580C" stroke="#FBBF24" strokeWidth="2" />
            <circle cx="150" cy="179" r="2.5" fill="#FEF08A" />
            <circle cx="165" cy="181" r="2" fill="#FEF08A" />
            <circle cx="173" cy="178" r="2" fill="#991B1B" />
          </motion.g>
        </motion.g>

        {/* Rising Golden Steam Clouds */}
        {[
          { cx: 145, cy: 155, delay: 0 },
          { cx: 165, cy: 135, delay: 0.5 },
          { cx: 180, cy: 115, delay: 1.0 },
        ].map((puff, pIdx) => (
          <motion.circle
            key={pIdx}
            cx={puff.cx}
            cy={puff.cy}
            r="12"
            fill="rgba(253, 186, 116, 0.4)"
            initial={{ opacity: 0, scale: 0.5, y: 15 }}
            animate={{
              opacity: [0, 0.7, 0],
              scale: [0.5, 1.4, 0.8],
              y: [15, -35],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: puff.delay,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Chef Upper Body & Toque Hat */}
        <motion.g
          animate={{
            y: [-2, 3, -2],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Chef Coat Shoulders */}
          <path
            d="M110 160 C110 135 210 135 210 160 L200 175 L120 175 Z"
            fill="#FFFFFF"
            stroke="#E4E4E7"
            strokeWidth="3"
          />
          {/* Chef Red Scarf / Neckerchief */}
          <path d="M145 138 L160 152 L175 138 Z" fill="#EF4444" />

          {/* Chef Happy Face */}
          <ellipse cx="160" cy="115" rx="28" ry="24" fill="#FED7AA" stroke="#FDBA74" strokeWidth="2" />
          {/* Happy Closed Eyes */}
          <path d="M147 113 Q152 108 157 113" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M163 113 Q168 108 173 113" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Cheerful Smile */}
          <path d="M153 123 Q160 130 167 123" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Rosy Cheeks */}
          <circle cx="145" cy="122" r="4" fill="#FCA5A5" opacity="0.7" />
          <circle cx="175" cy="122" r="4" fill="#FCA5A5" opacity="0.7" />
          {/* Chef Mustache */}
          <path d="M152 120 Q160 123 168 120" stroke="#78350F" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Chef Classic Toque Hat */}
          <g>
            <rect x="135" y="90" width="50" height="12" rx="4" fill="#F4F4F5" stroke="#E4E4E7" strokeWidth="2" />
            <path
              d="M135 90 C125 70 140 45 160 45 C180 45 195 70 185 90 Z"
              fill="#FFFFFF"
              stroke="#E4E4E7"
              strokeWidth="2.5"
            />
            <path d="M148 48 C142 62 144 85 145 90" stroke="#E4E4E7" strokeWidth="1.5" fill="none" />
            <path d="M172 48 C178 62 176 85 175 90" stroke="#E4E4E7" strokeWidth="1.5" fill="none" />
          </g>
        </motion.g>
      </svg>
    </div>
  );
};

/**
 * 3. Delivery Scooter / Out for Delivery Animation
 */
export const DeliveryScooterAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      <motion.div
        animate={{
          scale: [0.95, 1.15, 0.95],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-56 h-56 rounded-full bg-gradient-to-tr from-orange-500/30 to-amber-400/20 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 340 320"
        className="w-full h-full max-w-xs drop-shadow-[0_12px_28px_rgba(249,115,22,0.3)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Speed Wind Lines Rushing Left */}
        {[
          { y: 110, w: 70, delay: 0, speed: 0.9 },
          { y: 140, w: 90, delay: 0.3, speed: 0.7 },
          { y: 220, w: 80, delay: 0.1, speed: 0.8 },
          { y: 250, w: 60, delay: 0.4, speed: 1.0 },
        ].map((line, idx) => (
          <motion.line
            key={idx}
            x1="320"
            y1={line.y}
            x2={320 - line.w}
            y2={line.y}
            stroke="#F97316"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ x: 0, opacity: 0 }}
            animate={{
              x: [-40, -320],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: line.speed,
              repeat: Infinity,
              delay: line.delay,
              ease: "linear",
            }}
          />
        ))}

        {/* Road Surface & Dash Markers */}
        <line x1="20" y1="270" x2="320" y2="270" stroke="#3F3F46" strokeWidth="4" strokeLinecap="round" />
        <motion.line
          x1="300"
          y1="278"
          x2="80"
          y2="278"
          stroke="#F59E0B"
          strokeWidth="3"
          strokeDasharray="24 16"
          animate={{ strokeDashoffset: [0, 80] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
        />

        {/* Animated Scooter Chassis (Bouncing with Road Suspension) */}
        <motion.g
          animate={{
            y: [-3, 3, -3],
            rotate: [-0.8, 0.8, -0.8],
          }}
          transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "170px 240px" }}
        >
          {/* Back Delivery Thermal Box */}
          <g>
            <rect
              x="75"
              y="130"
              width="65"
              height="65"
              rx="12"
              fill="#EA580C"
              stroke="#C2410C"
              strokeWidth="3"
            />
            {/* Box Reflective Stripe */}
            <rect x="75" y="155" width="65" height="14" fill="#FED7AA" opacity="0.9" />
            <text
              x="107"
              y="166"
              textAnchor="middle"
              fill="#C2410C"
              fontSize="9"
              fontWeight="900"
              letterSpacing="0.05em"
            >
              FROSTY
            </text>

            {/* Steaming Aroma from the Box */}
            <motion.path
              d="M100 125 Q95 105 105 85"
              stroke="#FED7AA"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="8 6"
              animate={{ strokeDashoffset: [0, -28], opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              fill="none"
            />
          </g>

          {/* Scooter Frame & Body */}
          <path
            d="M125 200 L180 200 L215 160 L230 160"
            fill="none"
            stroke="#18181B"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Body Cover Paint (Frosty Brand Orange) */}
          <path
            d="M130 195 C145 195 165 190 190 180 L220 180 L205 210 L140 210 Z"
            fill="#F97316"
            stroke="#EA580C"
            strokeWidth="2"
          />

          {/* Handlebar & Headlight */}
          <path d="M205 160 L218 125 L232 125" stroke="#52525B" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M210 120 L235 120" stroke="#18181B" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Bright Headlight Beam */}
          <polygon points="230,135 310,120 310,165 230,145" fill="rgba(254, 240, 138, 0.35)" />
          <ellipse cx="230" cy="140" rx="5" ry="8" fill="#FEF08A" stroke="#F59E0B" strokeWidth="1.5" />

          {/* Rider / Delivery Hero */}
          <g>
            {/* Rider Jacket */}
            <path
              d="M145 145 C150 120 180 125 185 145 L195 175 L160 175 Z"
              fill="#27272A"
              stroke="#18181B"
              strokeWidth="2"
            />
            {/* Arms Holding Handle */}
            <path
              d="M170 140 L215 130"
              stroke="#27272A"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            {/* Helmet */}
            <circle cx="170" cy="105" r="18" fill="#F97316" stroke="#EA580C" strokeWidth="2.5" />
            {/* Helmet Visor */}
            <path
              d="M172 96 C182 96 188 104 188 114 L170 114 Z"
              fill="#09090B"
              stroke="#3F3F46"
              strokeWidth="1.5"
            />
          </g>

          {/* Back Wheel (Spinning) */}
          <g transform="translate(105, 240)">
            <circle cx="0" cy="0" r="24" fill="#18181B" stroke="#3F3F46" strokeWidth="3" />
            <circle cx="0" cy="0" r="14" fill="#27272A" stroke="#F97316" strokeWidth="2" />
            <motion.g animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}>
              <line x1="-14" y1="0" x2="14" y2="0" stroke="#71717A" strokeWidth="2" />
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#71717A" strokeWidth="2" />
            </motion.g>
            <circle cx="0" cy="0" r="5" fill="#F97316" />
          </g>

          {/* Front Wheel (Spinning) */}
          <g transform="translate(230, 240)">
            <circle cx="0" cy="0" r="24" fill="#18181B" stroke="#3F3F46" strokeWidth="3" />
            <circle cx="0" cy="0" r="14" fill="#27272A" stroke="#F97316" strokeWidth="2" />
            <motion.g animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}>
              <line x1="-14" y1="0" x2="14" y2="0" stroke="#71717A" strokeWidth="2" />
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#71717A" strokeWidth="2" />
            </motion.g>
            <circle cx="0" cy="0" r="5" fill="#F97316" />
          </g>

          {/* Exhaust Smoke Puff Ring */}
          {[
            { delay: 0 },
            { delay: 0.25 },
          ].map((smoke, idx) => (
            <motion.circle
              key={idx}
              cx="65"
              cy="235"
              r="6"
              fill="rgba(255,255,255,0.4)"
              initial={{ scale: 0.5, x: 0, opacity: 0.8 }}
              animate={{
                scale: [0.5, 2.2],
                x: [0, -35],
                y: [0, -10],
                opacity: [0.8, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: smoke.delay,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.g>
      </svg>
    </div>
  );
};

/**
 * 4. Order Processing / Pending / Payment Verifying Animation
 */
export const OrderProcessingAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      {/* Revolving Glowing Rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute w-56 h-56 rounded-full border border-dashed border-primary/30 pointer-events-none"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute w-44 h-44 rounded-full border border-dotted border-amber-400/20 pointer-events-none"
      />

      <svg
        viewBox="0 0 320 320"
        className="w-full h-full max-w-xs drop-shadow-[0_10px_25px_rgba(249,115,22,0.25)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Central Pulse Glow */}
        <motion.circle
          cx="160"
          cy="160"
          r="70"
          fill="rgba(249, 115, 22, 0.15)"
          animate={{
            r: [60, 85, 60],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating Receipt / Order Bill Card */}
        <motion.g
          animate={{
            y: [-6, 6, -6],
            rotate: [-2, 2, -2],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Receipt Background */}
          <path
            d="M110 80 L210 80 L210 230 L195 220 L180 230 L165 220 L150 230 L135 220 L120 230 L110 220 Z"
            fill="#18181B"
            stroke="#F97316"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Top Receipt Header Icon */}
          <rect x="135" y="95" width="50" height="8" rx="4" fill="#F59E0B" />
          
          {/* Order Lines Printing Effect */}
          {[
            { y: 118, w: 70, fill: "#71717A" },
            { y: 132, w: 55, fill: "#71717A" },
            { y: 146, w: 75, fill: "#71717A" },
            { y: 168, w: 70, fill: "#F97316" },
          ].map((row, idx) => (
            <motion.rect
              key={idx}
              x="125"
              y={row.y}
              width={row.w}
              height="5"
              rx="2.5"
              fill={row.fill}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.2 }}
            />
          ))}

          {/* Central Animated Clock / Stopwatch Indicator */}
          <g transform="translate(160, 195)">
            <circle cx="0" cy="0" r="16" fill="#27272A" stroke="#F59E0B" strokeWidth="2" />
            <motion.line
              x1="0"
              y1="0"
              x2="0"
              y2="-9"
              stroke="#F97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <motion.line
              x1="0"
              y1="0"
              x2="6"
              y2="0"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
          </g>
        </motion.g>

        {/* Orbiting Verification Sparkles */}
        {[
          { angle: 0, r: 90 },
          { angle: 120, r: 90 },
          { angle: 240, r: 90 },
        ].map((orbit, idx) => (
          <motion.g
            key={idx}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "160px 160px" }}
          >
            <circle cx="160" cy="65" r="4" fill="#F59E0B" className="drop-shadow-[0_0_8px_#F59E0B]" />
          </motion.g>
        ))}
      </svg>
    </div>
  );
};

/**
 * 5. Order Confirmed / Stamp of Freshness Animation
 */
export const OrderConfirmedAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      <motion.div
        animate={{
          scale: [0.9, 1.2, 0.9],
          opacity: [0.25, 0.5, 0.25],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-56 h-56 rounded-full bg-gradient-to-tr from-amber-500/30 to-emerald-500/20 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 320 320"
        className="w-full h-full max-w-xs drop-shadow-[0_12px_28px_rgba(245,158,11,0.25)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Badge Ribbon Base */}
        <motion.g
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          {/* Golden Outer Starburst Ring */}
          <motion.circle
            cx="160"
            cy="150"
            r="75"
            fill="#18181B"
            stroke="#F59E0B"
            strokeWidth="4"
            strokeDasharray="14 6"
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "160px 150px" }}
          />

          {/* Badge Inner Shield */}
          <circle cx="160" cy="150" r="62" fill="#27272A" stroke="#F97316" strokeWidth="3" />

          {/* Animated Big Glowing Checkmark */}
          <motion.path
            d="M135 150 L152 168 L188 132"
            fill="none"
            stroke="#10B981"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Badge Ribbons Hanging Below */}
          <path d="M130 205 L115 260 L145 245 L160 260 L155 210 Z" fill="#EA580C" stroke="#C2410C" strokeWidth="2" />
          <path d="M190 205 L205 260 L175 245 L160 260 L165 210 Z" fill="#F97316" stroke="#EA580C" strokeWidth="2" />

          {/* "CONFIRMED" Arc Text Banner */}
          <rect x="110" y="195" width="100" height="24" rx="8" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" />
          <text
            x="160"
            y="211"
            textAnchor="middle"
            fill="#18181B"
            fontSize="10"
            fontWeight="900"
            letterSpacing="0.1em"
          >
            CONFIRMED
          </text>
        </motion.g>

        {/* Celebrating Floating Star Particles */}
        {[
          { x: 80, y: 90, delay: 0 },
          { x: 240, y: 85, delay: 0.4 },
          { x: 75, y: 200, delay: 0.8 },
          { x: 245, y: 195, delay: 1.2 },
        ].map((star, idx) => (
          <motion.polygon
            key={idx}
            points={`${star.x},${star.y-8} ${star.x+2},${star.y-2} ${star.x+8},${star.y} ${star.x+2},${star.y+2} ${star.x},${star.y+8} ${star.x-2},${star.y+2} ${star.x-8},${star.y} ${star.x-2},${star.y-2}`}
            fill="#FBBF24"
            animate={{
              scale: [0.7, 1.3, 0.7],
              opacity: [0.4, 1, 0.4],
              rotate: [0, 45, 0],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: star.delay }}
            style={{ transformOrigin: `${star.x}px ${star.y}px` }}
          />
        ))}
      </svg>
    </div>
  );
};

/**
 * 6. Order Delivered / Success Celebration Animation
 */
export const OrderDeliveredAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      <motion.div
        animate={{
          scale: [0.95, 1.2, 0.95],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-60 h-60 rounded-full bg-gradient-to-tr from-emerald-500/30 to-green-400/20 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 320 320"
        className="w-full h-full max-w-xs drop-shadow-[0_12px_30px_rgba(16,185,129,0.3)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Confetti Explosion Shower */}
        {[
          { x: 70, y: 70, c: "#EF4444", r: 15, delay: 0 },
          { x: 100, y: 50, c: "#F59E0B", r: -20, delay: 0.2 },
          { x: 160, y: 40, c: "#10B981", r: 40, delay: 0.5 },
          { x: 220, y: 50, c: "#3B82F6", r: -35, delay: 0.3 },
          { x: 250, y: 75, c: "#EC4899", r: 25, delay: 0.7 },
          { x: 60, y: 140, c: "#F97316", r: -45, delay: 0.4 },
          { x: 260, y: 135, c: "#8B5CF6", r: 50, delay: 0.6 },
        ].map((c, idx) => (
          <motion.rect
            key={idx}
            x={c.x}
            y={c.y}
            width="8"
            height="14"
            rx="2"
            fill={c.c}
            animate={{
              y: [c.y, c.y + 35, c.y],
              rotate: [0, c.r * 4],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: c.delay,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Soft shadow */}
        <ellipse cx="160" cy="265" rx="75" ry="12" fill="rgba(0,0,0,0.4)" />

        {/* Celebration Gift / Delivered Treat Box */}
        <motion.g
          animate={{
            y: [-4, 4, -4],
            rotate: [-1, 1, -1],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Main Box */}
          <rect
            x="100"
            y="145"
            width="120"
            height="105"
            rx="16"
            fill="#18181B"
            stroke="#10B981"
            strokeWidth="3.5"
          />

          {/* Emerald Festive Ribbon */}
          <rect x="150" y="145" width="20" height="105" fill="#10B981" />
          <rect x="100" y="188" width="120" height="18" fill="#10B981" />

          {/* Top Lid */}
          <rect
            x="92"
            y="130"
            width="136"
            height="22"
            rx="6"
            fill="#27272A"
            stroke="#10B981"
            strokeWidth="3"
          />

          {/* Big Ribbon Bow on Top */}
          <g>
            <path
              d="M160 130 C130 90 115 130 160 130 Z"
              fill="#34D399"
              stroke="#059669"
              strokeWidth="2"
            />
            <path
              d="M160 130 C190 90 205 130 160 130 Z"
              fill="#34D399"
              stroke="#059669"
              strokeWidth="2"
            />
            <circle cx="160" cy="130" r="8" fill="#10B981" stroke="#059669" strokeWidth="2" />
          </g>

          {/* Success Checkmark Seal on Box Center */}
          <circle cx="160" cy="197" r="26" fill="#064E3B" stroke="#34D399" strokeWidth="2.5" />
          <motion.path
            d="M148 197 L157 206 L174 189"
            fill="none"
            stroke="#34D399"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "160px 197px" }}
          />
        </motion.g>
      </svg>
    </div>
  );
};

/**
 * 7. Order Cancelled Animation
 */
export const OrderCancelledAnimation: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center select-none", className)}>
      <motion.div
        animate={{
          scale: [0.95, 1.15, 0.95],
          opacity: [0.15, 0.35, 0.15],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-52 h-52 rounded-full bg-gradient-to-tr from-red-500/30 to-amber-500/20 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 320 320"
        className="w-full h-full max-w-xs drop-shadow-[0_10px_25px_rgba(239,68,68,0.25)] overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.g
          animate={{
            y: [-3, 3, -3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Shield Base */}
          <path
            d="M160 80 L230 110 C230 180 160 230 160 230 C160 230 90 180 90 110 Z"
            fill="#18181B"
            stroke="#EF4444"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Inner Red Alert Circle */}
          <circle cx="160" cy="150" r="40" fill="#27272A" stroke="#DC2626" strokeWidth="2.5" />

          {/* Animated Cancel 'X' */}
          <motion.line
            x1="145"
            y1="135"
            x2="175"
            y2="165"
            stroke="#EF4444"
            strokeWidth="5"
            strokeLinecap="round"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ transformOrigin: "160px 150px" }}
          />
          <motion.line
            x1="175"
            y1="135"
            x2="145"
            y2="165"
            stroke="#EF4444"
            strokeWidth="5"
            strokeLinecap="round"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ transformOrigin: "160px 150px" }}
          />

          {/* Cancelled Banner */}
          <rect x="110" y="210" width="100" height="22" rx="6" fill="#7F1D1D" stroke="#EF4444" strokeWidth="1.5" />
          <text
            x="160"
            y="225"
            textAnchor="middle"
            fill="#FCA5A5"
            fontSize="9"
            fontWeight="900"
            letterSpacing="0.1em"
          >
            CANCELLED
          </text>
        </motion.g>
      </svg>
    </div>
  );
};

/**
 * Universal Dynamic Animation Switcher Component
 */
export const DynamicFrostyAnimation: React.FC<{
  type?: AnimationType | string;
  className?: string;
}> = ({ type = 'empty_cart', className }) => {
  const norm = String(type).toLowerCase().replace(/[-_]/g, '_');

  if (norm.includes('cook') || norm.includes('chef') || norm.includes('prepar') || norm.includes('bake')) {
    return <ChefCookingAnimation className={className} />;
  }

  if (norm.includes('scooter') || norm.includes('delivery') || norm.includes('bike') || norm.includes('transit') || norm.includes('truck') || norm.includes('out_for_delivery')) {
    return <DeliveryScooterAnimation className={className} />;
  }

  if (norm.includes('process') || norm.includes('pending') || norm.includes('verif') || norm.includes('wait')) {
    return <OrderProcessingAnimation className={className} />;
  }

  if (norm.includes('confirm') || norm.includes('received')) {
    return <OrderConfirmedAnimation className={className} />;
  }

  if (norm.includes('deliver') || norm.includes('success') || norm.includes('complete')) {
    return <OrderDeliveredAnimation className={className} />;
  }

  if (norm.includes('cancel') || norm.includes('reject')) {
    return <OrderCancelledAnimation className={className} />;
  }

  // Default: Empty Cart / Bakery Sweets Treat Box
  return <EmptyCartAnimation className={className} />;
};
