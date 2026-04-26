import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  decimals?: number;
  className?: string;
  trendColor?: boolean;
}

export function NumberTicker({ value, decimals = 2, className, trendColor = false }: NumberTickerProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const flashTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value > prevValue) {
      setFlash("up");
    } else if (value < prevValue) {
      setFlash("down");
    }
    setPrevValue(value);

    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 300);

    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [value, prevValue]);

  const displayValue = value.toFixed(decimals);

  let colorClass = "";
  if (trendColor) {
    if (flash === "up") colorClass = "text-emerald-400";
    else if (flash === "down") colorClass = "text-red-500";
  }

  return (
    <motion.span
      key={displayValue}
      initial={{ opacity: 0.8, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("tabular-nums font-mono transition-colors duration-200", colorClass, className)}
    >
      {displayValue}
    </motion.span>
  );
}
