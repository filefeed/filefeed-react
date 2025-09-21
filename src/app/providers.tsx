"use client";

// Bundle Mantine core CSS so consumers don't need to import styles manually
import "@mantine/core/styles.css";

import React from "react";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <ModalsProvider>
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}
