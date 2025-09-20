"use client";

import React from "react";
import FilefeedWorkbook from "../components/FilefeedWorkbook";
import { CreateWorkbookConfig } from "@/types";

const demoConfig: CreateWorkbookConfig = {
  name: "Customer Data Import",
  labels: ["Demo", "Customer Management"],
  namespace: "demo",
  spaceId: "demo-space",
  environmentId: "development",
  metadata: {
    version: "1.0.0",
    description: "Demo workbook for customer data onboarding",
  },
  sheets: [
    {
      name: "Customers",
      slug: "customers",
      mappingConfidenceThreshold: 0.7,
      fields: [
        {
          key: "firstName",
          label: "First Name",
          type: "string",
          required: true,
          description: "Customer's first name",
          validations: [
            {
              type: "min",
              value: 2,
              message: "First name must be at least 2 characters long",
            },
          ],
        },
        {
          key: "lastName",
          label: "Last Name",
          type: "string",
          required: true,
          description: "Customer's last name",
          validations: [
            {
              type: "min",
              value: 2,
              message: "Last name must be at least 2 characters long",
            },
          ],
        },
        {
          key: "email",
          label: "Email Address",
          type: "email",
          required: true,
          unique: true,
          description: "Customer's email address (must be unique)",
          validations: [
            {
              type: "regex",
              value: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
              message: "Please enter a valid email address",
            },
          ],
        },
        {
          key: "phone",
          label: "Phone Number",
          type: "string",
          required: false,
          description: "Customer's phone number",
          validations: [
            {
              type: "regex",
              value: "^[\\+]?[1-9][\\d\\s\\-\\(\\)]{7,15}$",
              message: "Please enter a valid phone number",
            },
          ],
        },
        {
          key: "age",
          label: "Age",
          type: "number",
          required: false,
          description: "Customer's age",
          validations: [
            {
              type: "min",
              value: 18,
              message: "Customer must be at least 18 years old",
            },
            {
              type: "max",
              value: 120,
              message: "Please enter a valid age",
            },
          ],
        },
        {
          key: "dateOfBirth",
          label: "Date of Birth",
          type: "date",
          required: false,
          description: "Customer's date of birth",
        },
        {
          key: "isActive",
          label: "Active Customer",
          type: "boolean",
          required: true,
          description: "Whether the customer is currently active",
        },
        {
          key: "customerType",
          label: "Customer Type",
          type: "string",
          required: true,
          description: "Type of customer (individual, business, etc.)",
          validations: [
            {
              type: "regex",
              value: "^(individual|business|enterprise)$",
              message:
                "Customer type must be: individual, business, or enterprise",
            },
          ],
        },
      ],
    },
    {
      name: "Orders",
      slug: "orders",
      mappingConfidenceThreshold: 0.8,
      fields: [
        {
          key: "orderId",
          label: "Order ID",
          type: "string",
          required: true,
          unique: true,
          description: "Unique order identifier",
        },
        {
          key: "customerEmail",
          label: "Customer Email",
          type: "email",
          required: true,
          description: "Email of the customer who placed the order",
        },
        {
          key: "orderDate",
          label: "Order Date",
          type: "date",
          required: true,
          description: "Date when the order was placed",
        },
        {
          key: "totalAmount",
          label: "Total Amount",
          type: "number",
          required: true,
          description: "Total order amount in USD",
          validations: [
            {
              type: "min",
              value: 0,
              message: "Order amount must be positive",
            },
          ],
        },
        {
          key: "status",
          label: "Order Status",
          type: "string",
          required: true,
          description: "Current status of the order",
          validations: [
            {
              type: "regex",
              value: "^(pending|processing|shipped|delivered|cancelled)$",
              message:
                "Status must be: pending, processing, shipped, delivered, or cancelled",
            },
          ],
        },
      ],
    },
  ],
  actions: [
    {
      operation: "review",
      label: "Review Data",
      description: "Review the imported data for accuracy",
      primary: false,
      mode: "foreground",
    },
    {
      operation: "validate",
      label: "Validate All",
      description: "Run validation on all imported data",
      primary: false,
      mode: "background",
    },
    {
      operation: "submit",
      label: "Submit Data",
      description: "Submit the validated data to the system",
      primary: true,
      mode: "foreground",
    },
    {
      operation: "download",
      label: "Download CSV",
      description: "Download the processed data as CSV",
      primary: false,
      mode: "background",
    },
  ],
  settings: {
    trackChanges: true,
  },
};

export default function HomePage() {
  const handleDataImported = (data: any) => {
    console.log("Data imported:", data);
  };

  const handleMappingChanged = (mapping: any) => {
    console.log("Mapping changed:", mapping);
  };

  const handleValidationComplete = (errors: any) => {
    console.log("Validation complete:", errors);
  };

  const handleActionTriggered = (action: any, data: any) => {
    console.log("Action triggered:", action, data);
  };

  const handleWorkbookComplete = (data: any) => {
    console.log("Workbook complete:", data);
  };

  return (
    <FilefeedWorkbook
      config={demoConfig}
      events={{
        onDataImported: handleDataImported,
        onMappingChanged: handleMappingChanged,
        onValidationComplete: handleValidationComplete,
        onActionTriggered: handleActionTriggered,
        onWorkbookComplete: handleWorkbookComplete,
      }}
      theme="light"
      className="filefeed-demo"
    />
  );
}
