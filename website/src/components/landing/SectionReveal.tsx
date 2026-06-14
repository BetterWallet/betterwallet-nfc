"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
};

export function SectionReveal({ children, className, delay = 0, id }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const sectionClassName = `scroll-mt-24 ${className ?? ""}`.trim();

  if (prefersReducedMotion) {
    return (
      <section id={id} className={sectionClassName}>
        {children}
      </section>
    );
  }

  return (
    <motion.section
      id={id}
      className={sectionClassName}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}
