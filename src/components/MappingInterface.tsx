'use client';

import React, { useState } from 'react';
import {
  Card,
  Group,
  Text,
  Select,
  Badge,
  Stack,
  Button,
  Grid,
  Alert,
  Progress,
  ActionIcon,
  Box,
  Title,
  Flex,
  Divider,
} from '@mantine/core';
import { 
  IconArrowRight, 
  IconWand, 
  IconCheck, 
  IconX, 
  IconAlertTriangle,
  IconRefresh 
} from '@tabler/icons-react';
import { MappingInterfaceProps } from '../types';

const MappingInterface: React.FC<MappingInterfaceProps> = ({
  importedHeaders,
  fields,
  mapping,
  onMappingChange,
  confidenceThreshold = 0.7,
  importedData,
}) => {
  const [hoveredMapping, setHoveredMapping] = useState<string | null>(null);

  const handleMappingUpdate = (sourceColumn: string, targetField: string | null) => {
    const newMapping = { ...mapping, [sourceColumn]: targetField };
    onMappingChange(newMapping);
  };

  const getPreviewData = (sourceColumn: string) => {
    if (!importedData?.rows) return [];
    return importedData.rows.slice(0, 3).map(row => row[sourceColumn]).filter(val => val !== undefined && val !== null && val !== '');
  };

  const incomingFieldsCount = importedHeaders.length;
  const destinationFieldsCount = fields.length;
  const mappedCount = Object.values(mapping).filter(value => value !== null).length;

  return (
    <Box style={{ padding: '24px' }}>
      {/* Header */}
      <Box mb="xl">
        <Title order={2} size="h3" fw={600} mb="xs">
          Map fields
        </Title>
        <Text size="sm" c="gray.6">
          Review and confirm each mapping choice
        </Text>
      </Box>

      {/* Main Layout */}
      <Flex gap="xl" align="flex-start">
        {/* Left Side - Mapping */}
        <Box style={{ flex: 2 }}>
          {/* Field Counts */}
          <Flex gap="xl" mb="lg">
            <Box>
              <Text size="sm" fw={600} c="gray.8" mb="xs">
                INCOMING FIELDS {incomingFieldsCount} of {incomingFieldsCount}
              </Text>
            </Box>
            <Box>
              <Text size="sm" fw={600} c="gray.8" mb="xs">
                DESTINATION FIELDS {mappedCount} of {destinationFieldsCount}
              </Text>
            </Box>
          </Flex>

          {/* Mapping Rows */}
          <Stack gap="sm">
            {importedHeaders.map((header) => {
              const mappedField = mapping[header];
              const targetField = fields.find(f => f.key === mappedField);
              
              return (
                <Card 
                  key={header} 
                  padding="md" 
                  radius="md" 
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: hoveredMapping === header ? 'var(--mantine-color-gray-0)' : 'white'
                  }}
                  onMouseEnter={() => setHoveredMapping(header)}
                  onMouseLeave={() => setHoveredMapping(null)}
                >
                  <Flex align="center" gap="md">
                    {/* Incoming Field */}
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={500} c="gray.8">
                        {header}
                      </Text>
                    </Box>

                    {/* Arrow */}
                    <Box>
                      <IconArrowRight size={16} color="gray" />
                    </Box>

                    {/* Destination Field */}
                    <Box style={{ flex: 1 }}>
                      <Select
                        placeholder="Select destination field"
                        value={mappedField}
                        onChange={(value) => handleMappingUpdate(header, value)}
                        data={fields.map(field => ({
                          value: field.key,
                          label: `${field.label} (${field.type})${field.required ? ' *' : ''}`,
                        }))}
                        searchable
                        clearable
                        size="sm"
                        styles={{
                          input: {
                            backgroundColor: mappedField ? 'var(--mantine-color-green-0)' : undefined,
                            borderColor: mappedField ? 'var(--mantine-color-green-3)' : undefined
                          }
                        }}
                      />
                    </Box>
                  </Flex>
                </Card>
              );
            })}
          </Stack>
        </Box>

        {/* Right Side - Preview */}
        <Box style={{ flex: 1 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder style={{ position: 'sticky', top: '20px' }}>
            <Text size="sm" fw={600} c="gray.8" mb="md">
              Data Preview
            </Text>
            
            {hoveredMapping ? (
              <Box>
                <Text size="xs" fw={500} c="gray.6" mb="xs">
                  {hoveredMapping}
                </Text>
                <Stack gap="xs">
                  {getPreviewData(hoveredMapping).slice(0, 5).map((value, index) => (
                    <Box 
                      key={index}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: 'var(--mantine-color-gray-0)',
                        borderRadius: '4px',
                        border: '1px solid var(--mantine-color-gray-2)'
                      }}
                    >
                      <Text size="xs" c="gray.7">
                        {String(value)}
                      </Text>
                    </Box>
                  ))}
                  {getPreviewData(hoveredMapping).length === 0 && (
                    <Text size="xs" c="gray.5" style={{ fontStyle: 'italic' }}>
                      No data available
                    </Text>
                  )}
                </Stack>
              </Box>
            ) : (
              <Text size="xs" c="gray.5" style={{ fontStyle: 'italic' }}>
                Hover over a mapping row to see data preview
              </Text>
            )}
          </Card>
        </Box>
      </Flex>
    </Box>
  );
};

export default MappingInterface;