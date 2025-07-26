'use client';

import React, { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Badge,
  Stack,
  Modal,
  LoadingOverlay,
  Progress,
  Card,
  Divider,
  Box,
  Flex,
  ThemeIcon,
  Tabs,
  SegmentedControl,
  Table,
  ScrollArea,
} from '@mantine/core';
import {
  IconFileImport,
  IconMapPin,
  IconTable,
  IconCheck,
  IconSettings,
  IconDownload,
  IconPlayerPlay,
  IconChevronRight,
  IconCircleCheck,
  IconCircle,
  IconUpload,
  IconEdit,
} from '@tabler/icons-react';
import { CellvioSDKProps, Action } from '../types';
import { useWorkbookStore } from '../stores/workbookStore';
import FileImport from './FileImport';
import DataTable from './DataTable';
import MappingInterface from './MappingInterface';

const CellvioWorkbook: React.FC<CellvioSDKProps> = ({
  config,
  events,
  theme = 'light',
  className,
}) => {
  const [activeTab, setActiveTab] = useState<string>('import');
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [isManualEntryMode, setIsManualEntryMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [manualEntryData, setManualEntryData] = useState<Record<string, Record<string, any>>>({});
  const [manualEntryErrors, setManualEntryErrors] = useState<Record<string, Record<string, string>>>({});
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [tableContainerRef, setTableContainerRef] = useState<HTMLDivElement | null>(null);
  const [maxRows, setMaxRows] = useState(18); // Default fallback

  const {
    setConfig,
    currentSheet,
    importedData,
    setImportedData,
    mappingState,
    updateMapping,
    processedData,
    updateRowData,
    validationErrors,
    isLoading,
    setLoading,
  } = useWorkbookStore();

  // Initialize workbook with config
  useEffect(() => {
    setConfig(config);
  }, [config, setConfig]);

  // Get current sheet configuration
  const currentSheetConfig = config.sheets?.find(sheet => sheet.slug === currentSheet);

  // Validation function for manual entry
  const validateField = (fieldKey: string, value: any): string | null => {
    const field = currentSheetConfig?.fields.find(f => f.key === fieldKey);
    if (!field) return null;

    // Required field validation
    if (field.required && (!value || value.toString().trim() === '')) {
      return `${field.label} is required`;
    }

    // Skip validation for empty optional fields
    if (!value || value.toString().trim() === '') {
      return null;
    }

    // Type validation
    switch (field.type) {
      case 'number':
        if (isNaN(Number(value))) {
          return `${field.label} must be a valid number`;
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.toString())) {
          return `${field.label} must be a valid email address`;
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value.toString()))) {
          return `${field.label} must be a valid date`;
        }
        break;
    }

    // Custom validation rules
    if (field.validations) {
      for (const rule of field.validations) {
        switch (rule.type) {
          case 'regex':
            if (rule.value && !new RegExp(rule.value).test(value.toString())) {
              return rule.message;
            }
            break;
          case 'min':
            if (field.type === 'number' && Number(value) < rule.value) {
              return rule.message;
            }
            if (field.type === 'string' && value.toString().length < rule.value) {
              return rule.message;
            }
            break;
          case 'max':
            if (field.type === 'number' && Number(value) > rule.value) {
              return rule.message;
            }
            if (field.type === 'string' && value.toString().length > rule.value) {
              return rule.message;
            }
            break;
        }
      }
    }

    return null;
  };

  // Handle manual entry input changes
  const handleManualEntryChange = (rowIndex: number, fieldKey: string, value: string) => {
    const rowId = `manual-${rowIndex}`;
    
    // Update data
    setManualEntryData(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [fieldKey]: value
      }
    }));

    // Validate field
    const error = validateField(fieldKey, value);
    setManualEntryErrors(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [fieldKey]: error || ''
      }
    }));
  };

  // Calculate validation counts for segmented control
  const getValidationCounts = () => {
    let totalRows = 0;
    let validRows = 0;
    let invalidRows = 0;

    Object.keys(manualEntryData).forEach(rowId => {
      const rowData = manualEntryData[rowId];
      const rowErrors = manualEntryErrors[rowId] || {};
      
      // Check if row has any data
      const hasData = Object.values(rowData).some(value => value && value.toString().trim() !== '');
      
      if (hasData) {
        totalRows++;
        const hasErrors = Object.values(rowErrors).some(error => error && error.trim() !== '');
        
        if (hasErrors) {
          invalidRows++;
        } else {
          validRows++;
        }
      }
    });

    return { totalRows, validRows, invalidRows };
  };

  const [isCalculatingValidation, setIsCalculatingValidation] = useState(false);
  const { totalRows, validRows, invalidRows } = getValidationCounts();

  // Determine if a row should be visible based on the selected filter
  const isRowVisible = (rowIndex: number): boolean => {
    if (selectedFilter === 'all') return true;
    
    const rowId = `manual-${rowIndex}`;
    const rowData = manualEntryData[rowId];
    const rowErrors = manualEntryErrors[rowId] || {};
    
    // Check if row has any data
    const hasData = rowData && Object.values(rowData).some(value => value && value.toString().trim() !== '');
    
    // Only show rows with data when filtering
    if (!hasData) return false;
    
    // Check if row has validation errors
    const hasErrors = Object.values(rowErrors).some(error => error && error.trim() !== '');
    
    if (selectedFilter === 'valid') return !hasErrors;
    if (selectedFilter === 'invalid') return hasErrors;
    
    return true;
  };

  // Calculate dynamic row count based on container height
  useEffect(() => {
    if (!tableContainerRef) return;

    const calculateMaxRows = () => {
      const containerHeight = tableContainerRef.clientHeight;
      const headerHeight = 24 + 2; // 24px row height + borders
      const rowHeight = 24 + 1; // 24px row height + border
      const padding = 32; // Container padding
      
      const availableHeight = containerHeight - headerHeight - padding;
      const calculatedRows = Math.floor(availableHeight / rowHeight);
      
      // Ensure minimum of 5 rows and maximum of 50 rows
      const newMaxRows = Math.max(5, Math.min(50, calculatedRows));
      setMaxRows(newMaxRows);
    };

    // Initial calculation
    calculateMaxRows();

    // Set up ResizeObserver to recalculate on container size changes
    const resizeObserver = new ResizeObserver(() => {
      calculateMaxRows();
    });

    resizeObserver.observe(tableContainerRef);

    return () => {
      resizeObserver.disconnect();
    };
  }, [tableContainerRef]);

  // Add debounced validation calculation to show spinner
  useEffect(() => {
    if (Object.keys(manualEntryData).length > 0) {
      setIsCalculatingValidation(true);
      const timer = setTimeout(() => {
        setIsCalculatingValidation(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [manualEntryData, manualEntryErrors]);

  const handleDataImported = (data: any) => {
    setImportedData(data);
    setActiveTab('mapping');
    events?.onDataImported?.(data);
  };

  const handleMappingChange = (mapping: any) => {
    Object.entries(mapping).forEach(([sourceColumn, targetField]) => {
      updateMapping(sourceColumn, targetField as string | null);
    });
    events?.onMappingChanged?.(mapping);
  };

  const handleActionClick = (action: Action) => {
    setSelectedAction(action);
    events?.onActionTriggered?.(action, processedData);
  };

  const getActionIcon = (operation: string) => {
    switch (operation) {
      case 'submit': return <IconCheck size={16} />;
      case 'download': return <IconDownload size={16} />;
      case 'review': return <IconTable size={16} />;
      case 'process': return <IconPlayerPlay size={16} />;
      default: return <IconSettings size={16} />;
    }
  };

  // Step configuration
  const steps = [
    { id: 'import', label: 'Import Data', icon: IconFileImport, completed: !!importedData },
    { id: 'mapping', label: 'Map Columns', icon: IconMapPin, completed: Object.keys(mappingState).length > 0 },
    { id: 'review', label: 'Review & Edit', icon: IconTable, completed: processedData.length > 0 },
  ];

  const currentStepIndex = steps.findIndex(step => step.id === activeTab);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className={`cellvio-workbook ${className || ''}`} data-theme={theme}>
      <LoadingOverlay visible={isLoading} />
      
      <Container size="xl" py="xl">
        {/* Show mapping interface if we're in mapping mode */}
        {activeTab === 'mapping' && importedData && currentSheetConfig ? (
          <Card shadow="sm" padding={0} radius="md" withBorder>
            <MappingInterface
              importedHeaders={importedData.headers}
              fields={currentSheetConfig.fields}
              mapping={mappingState}
              onMappingChange={handleMappingChange}
              importedData={importedData}
              onBack={() => setActiveTab('import')}
              onContinue={() => setActiveTab('review')}
              onExit={() => setActiveTab('import')}
            />
          </Card>
        ) : activeTab === 'review' && importedData && currentSheetConfig ? (
          /* Review tab - same layout as first screen with mapped data */
          <Card shadow="sm" padding="md" radius="md" withBorder>
            {/* Top section - title and controls */}
            <Group justify="space-between" align="center">
              <Text size="sm" c="gray.8" fw={500}>
                Review Mapped Data
              </Text>
              <Group gap="md">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setActiveTab('mapping')}
                  styles={{
                    root: {
                      backgroundColor: 'white',
                      borderColor: 'black',
                      color: 'black',
                      '&:hover': {
                        backgroundColor: 'var(--mantine-color-gray-0)'
                      }
                    }
                  }}
                >
                  Back to Mapping
                </Button>
                <Button
                  size="xs"
                  radius="md"
                  onClick={() => {
                    // Transform and submit the mapped data
                    const mappedData = importedData.rows.map(row => {
                      const transformedRow: any = {};
                      Object.entries(mappingState).forEach(([sourceHeader, targetField]) => {
                        if (targetField && row[sourceHeader] !== undefined) {
                          const field = currentSheetConfig.fields.find(f => f.key === targetField);
                          transformedRow[field?.label || targetField] = row[sourceHeader];
                        }
                      });
                      return transformedRow;
                    });
                    
                    // Transform mapped data to DataRow[] format
                    const dataRows: any[] = mappedData.map((row, index) => ({
                      id: `row-${index}`,
                      data: row
                    }));
                    
                    events?.onWorkbookComplete?.(dataRows);
                  }}
                  styles={{
                    root: {
                      backgroundColor: 'black',
                      color: 'white',
                      border: 'none',
                      '&:hover': {
                        backgroundColor: '#333'
                      }
                    }
                  }}
                >
                  Submit {currentSheetConfig?.name} Data
                </Button>
                <div style={{
                  display: 'flex',
                  backgroundColor: 'var(--mantine-color-gray-1)',
                  borderRadius: '6px',
                  padding: '2px',
                  gap: '2px'
                }}>
                  {[
                    { label: 'All', value: 'all', count: importedData.rows.length },
                    { label: 'Valid', value: 'valid', count: importedData.rows.length },
                    { label: 'Invalid', value: 'invalid', count: 0 }
                  ].map((item) => (
                    <button
                      key={item.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: item.value === 'all' ? 'white' : 'transparent',
                        color: 'var(--mantine-color-gray-7)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: item.value === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.count > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--mantine-color-gray-4)',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {item.count}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Group>
            </Group>
            
            {/* Divider between header and table */}
            <Divider my="md" />
            
            {/* Table section with mapped data - scrollable */}
            <ScrollArea h={600}>
              <Table 
                striped={false}
                highlightOnHover={true} 
                withTableBorder
                withColumnBorders
                style={{ 
                  backgroundColor: 'white',
                  borderCollapse: 'collapse',
                  width: '100%'
                }}
              >
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    {Object.entries(mappingState)
                      .filter(([_, targetField]) => targetField)
                      .map(([_, targetField]) => {
                        const field = currentSheetConfig.fields.find(f => f.key === targetField);
                        return (
                          <Table.Th 
                            key={targetField} 
                            style={{ 
                              color: 'var(--mantine-color-gray-8)',
                              fontWeight: 500,
                              fontSize: '12px',
                              borderBottom: '1px solid var(--mantine-color-gray-3)',
                              borderRight: '1px solid var(--mantine-color-gray-3)',
                              backgroundColor: 'var(--mantine-color-gray-0)',
                              padding: '6px 10px',
                              minWidth: '120px',
                              position: 'sticky',
                              top: 0,
                              zIndex: 1
                            }}
                          >
                            {field?.label || targetField}
                          </Table.Th>
                        );
                      })}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {importedData.rows.map((row, index) => (
                    <Table.Tr key={index}>
                      {Object.entries(mappingState)
                        .filter(([_, targetField]) => targetField)
                        .map(([sourceHeader, targetField]) => (
                          <Table.Td 
                            key={`${index}-${targetField}`}
                            style={{
                              borderBottom: '1px solid var(--mantine-color-gray-3)',
                              borderRight: '1px solid var(--mantine-color-gray-3)',
                              padding: '6px 10px',
                              fontSize: '12px',
                              color: 'var(--mantine-color-gray-8)',
                              backgroundColor: 'white'
                            }}
                          >
                            {row[sourceHeader] || ''}
                          </Table.Td>
                        ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        ) : (
          /* Original table design - single card with dividers */
          <Card shadow="sm" padding="md" radius="md" withBorder>
            {/* Top section - title and controls */}
            <Group justify="space-between" align="center">
              <Text size="sm" c="gray.8" fw={500}>
                {currentSheetConfig?.name || 'Data Sheet'}
              </Text>
              <Group gap="md">
                {/* Submit button - only show if there's mapped data */}
                {Object.keys(mappingState).length > 0 && (
                  <Button
                    size="xs"
                    radius="md"
                    onClick={() => {
                      // Transform and submit the mapped data
                      const mappedData = importedData.rows.map(row => {
                        const transformedRow: any = {};
                        Object.entries(mappingState).forEach(([sourceHeader, targetField]) => {
                          if (targetField && row[sourceHeader] !== undefined) {
                            const field = currentSheetConfig.fields.find(f => f.key === targetField);
                            transformedRow[field?.label || targetField] = row[sourceHeader];
                          }
                        });
                        return transformedRow;
                      });
                      
                      // Transform mapped data to DataRow[] format
                      const dataRows: any[] = mappedData.map((row, index) => ({
                        id: `row-${index}`,
                        data: row
                      }));
                      
                      events?.onWorkbookComplete?.(dataRows);
                    }}
                    styles={{
                      root: {
                        backgroundColor: 'black',
                        color: 'white',
                        border: 'none',
                        '&:hover': {
                          backgroundColor: '#333'
                        }
                      }
                    }}
                  >
                    Submit {currentSheetConfig?.name} Data
                  </Button>
                )}
                <div style={{
                  display: 'flex',
                  backgroundColor: 'var(--mantine-color-gray-1)',
                  borderRadius: '6px',
                  padding: '2px',
                  gap: '2px'
                }}>
                  {[
                    { label: 'All', value: 'all', count: totalRows },
                    { label: 'Valid', value: 'valid', count: validRows },
                    { label: 'Invalid', value: 'invalid', count: invalidRows }
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setSelectedFilter(item.value as 'all' | 'valid' | 'invalid')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: item.value === selectedFilter ? 'white' : 'transparent',
                        color: 'var(--mantine-color-gray-7)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: item.value === selectedFilter ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (item.value !== selectedFilter) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (item.value !== selectedFilter) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span>{item.label}</span>
                      {(item.count > 0 || isCalculatingValidation) && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--mantine-color-gray-4)',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {isCalculatingValidation ? (
                            <div style={{
                              width: '10px',
                              height: '10px',
                              border: '2px solid white',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                          ) : (
                            item.count
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </Group>
            </Group>
            
            {/* Divider between header and table */}
            <Divider my="md" />
            
            {/* Table section */}
            <Box style={{ position: 'relative', minHeight: '600px', overflow: 'hidden' }}>
                {/* Background table grid */}
                <Box style={{ position: 'absolute', inset: 0, zIndex: 1, padding: '16px' }}>
                  <div 
                    ref={setTableContainerRef}
                    style={{ 
                      height: '100%', 
                      minHeight: '400px', 
                      overflow: 'hidden' 
                    }}
                  >
                    {currentSheetConfig && (
                      <Table 
                        striped={false}
                        highlightOnHover={false} 
                        withTableBorder
                        withColumnBorders
                        style={{ 
                          height: '100%',
                          opacity: isManualEntryMode ? 1 : 0.98,
                          filter: isManualEntryMode ? 'none' : 'blur(0.5px)',
                          pointerEvents: isManualEntryMode ? 'auto' : 'none',
                          backgroundColor: 'white',
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed',
                          width: '100%'
                        }}
                      >
                        <Table.Thead>
                          <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                            {currentSheetConfig.fields.map((field) => (
                              <Table.Th 
                                key={field.key} 
                                style={{ 
                                  color: isManualEntryMode ? 'var(--mantine-color-gray-8)' : 'var(--mantine-color-gray-5)',
                                  fontWeight: 500,
                                  fontSize: '12px',
                                  height: '24px',
                                  borderBottom: '1px solid var(--mantine-color-gray-3)',
                                  borderRight: '1px solid var(--mantine-color-gray-3)',
                                  backgroundColor: 'var(--mantine-color-gray-0)',
                                  padding: '6px 10px',
                                  width: `${100 / currentSheetConfig.fields.length}%`,
                                  minWidth: '120px',
                                  maxWidth: `${100 / currentSheetConfig.fields.length}%`
                                }}
                              >
                                {field.label}
                              </Table.Th>
                            ))}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {/* Generate editable rows for manual entry - dynamic row count */}
                          {(() => {
                            const visibleDataRows = Array.from({ length: maxRows }, (_, i) => i).filter(isRowVisible);
                            const totalRows = [];
                            
                            // Add visible data rows
                            visibleDataRows.forEach((originalIndex) => {
                              totalRows.push({ type: 'data', originalIndex });
                            });
                            
                            // Add blank rows to reach maxRows total
                            const blanksNeeded = maxRows - visibleDataRows.length;
                            for (let i = 0; i < blanksNeeded; i++) {
                              totalRows.push({ type: 'blank', originalIndex: maxRows + i });
                            }
                            
                            return totalRows.map((row, displayIndex) => (
                              <Table.Tr key={row.type === 'data' ? `data-${row.originalIndex}` : `blank-${row.originalIndex}`} style={{ backgroundColor: 'white' }}>
                                {currentSheetConfig.fields.map((field) => {
                                  const isDataRow = row.type === 'data';
                                  const rowIndex = isDataRow ? row.originalIndex : row.originalIndex;
                                  
                                  return (
                                    <Table.Td 
                                      key={field.key} 
                                      style={{ 
                                        color: 'var(--mantine-color-gray-5)',
                                        fontSize: '12px',
                                        padding: '0',
                                        borderRight: '1px solid var(--mantine-color-gray-3)',
                                        borderBottom: displayIndex === totalRows.length - 1 ? '2px solid var(--mantine-color-gray-3)' : '1px solid var(--mantine-color-gray-3)',
                                        backgroundColor: 'white',
                                        minHeight: '24px',
                                        width: `${100 / currentSheetConfig.fields.length}%`,
                                        minWidth: '120px',
                                        maxWidth: `${100 / currentSheetConfig.fields.length}%`,
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {isManualEntryMode ? (
                                        <input
                                          type={field.type === 'number' ? 'number' : 'text'}
                                          value={isDataRow ? (manualEntryData[`manual-${row.originalIndex}`]?.[field.key] || '') : ''}
                                          onChange={(e) => {
                                            if (isDataRow) {
                                              handleManualEntryChange(row.originalIndex, field.key, e.target.value);
                                            } else {
                                              // For blank rows, start new data entry
                                              handleManualEntryChange(rowIndex, field.key, e.target.value);
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            height: '24px',
                                            minHeight: '24px',
                                            maxHeight: '24px',
                                            border: (isDataRow && manualEntryErrors[`manual-${row.originalIndex}`]?.[field.key]) 
                                              ? '1px solid var(--mantine-color-red-5)' 
                                              : '1px solid transparent',
                                            outline: 'none',
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            backgroundColor: (isDataRow && manualEntryErrors[`manual-${row.originalIndex}`]?.[field.key]) 
                                              ? 'var(--mantine-color-red-0)' 
                                              : 'transparent',
                                            color: 'var(--mantine-color-gray-8)',
                                            boxSizing: 'border-box',
                                            minWidth: 0,
                                            borderRadius: '0px',
                                            transition: 'border-color 0.1s ease, background-color 0.1s ease'
                                          }}
                                          onFocus={(e) => {
                                            const errorKey = isDataRow ? `manual-${row.originalIndex}` : `manual-${rowIndex}`;
                                            if (!manualEntryErrors[errorKey]?.[field.key]) {
                                              e.target.style.border = '1px solid black';
                                              e.target.style.borderRadius = '2px';
                                            }
                                          }}
                                          onBlur={(e) => {
                                            const errorKey = isDataRow ? `manual-${row.originalIndex}` : `manual-${rowIndex}`;
                                            if (!manualEntryErrors[errorKey]?.[field.key]) {
                                              e.target.style.border = '1px solid transparent';
                                              e.target.style.borderRadius = '0px';
                                            }
                                          }}
                                          title={(isDataRow && manualEntryErrors[`manual-${row.originalIndex}`]?.[field.key]) || undefined}
                                        />
                                      ) : (
                                        <div style={{ 
                                          padding: '6px 10px', 
                                          height: '24px',
                                          minHeight: '24px',
                                          boxSizing: 'border-box',
                                          display: 'flex',
                                          alignItems: 'center'
                                        }}>
                                          {/* Always blank - no sample text */}
                                        </div>
                                      )}
                                    </Table.Td>
                                  );
                                })}
                              </Table.Tr>
                            ));
                          })()}
                        </Table.Tbody>
                      </Table>
                    )}
                  </div>
                </Box>

                {/* Overlay with centered content - hidden in manual entry mode */}
                {!isManualEntryMode && (
                  <Flex 
                    align="center" 
                    justify="center" 
                    direction="column" 
                    style={{ 
                      position: 'absolute', 
                      inset: 0, 
                      zIndex: 3,
                      backgroundColor: 'rgba(255, 255, 255, 0.02)', // Only 2% overlay
                      backdropFilter: 'none'
                    }}
                  >
                    <Stack align="center" gap="sm">
                      <div style={{ textAlign: 'center' }}>
                        <Title order={2} size="sm" fw={600} c="gray.8">
                          Drag and drop or upload a file to get started
                        </Title>
                      </div>
                      
                      <Stack gap="md" align="center">
                        <Button 
                          size="xs" 
                          variant="outline"
                          color="dark"
                          leftSection={<IconUpload size={15} />}
                          loading={isUploading}
                          onClick={() => {
                            // Trigger file upload using the existing FileImport component logic
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.csv,.xlsx,.xls';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                try {
                                  setIsUploading(true);
                                  // Use the same file processing logic as FileImport
                                  const { parseCSV, parseExcel } = await import('../utils/dataProcessing');
                                  let data;
                                  
                                  if (file.name.endsWith('.csv')) {
                                    data = await parseCSV(file);
                                  } else {
                                    data = await parseExcel(file);
                                  }
                                  
                                  handleDataImported(data);
                                } catch (error) {
                                  console.error('Error processing file:', error);
                                } finally {
                                  setIsUploading(false);
                                }
                              }
                            };
                            input.click();
                          }}
                          styles={{
                            root: {
                              backgroundColor: 'white',
                              borderColor: 'gray',
                              color: 'black',
                              fontSize: '12px',
                              '&:hover': {
                                backgroundColor: 'var(--mantine-color-gray-0)'
                              }
                            }
                          }}
                        >
                          Upload file
                        </Button>
                        
                        <Button 
                          size="xs" 
                          variant="outline"
                          color="dark"
                          leftSection={<IconEdit size={15} />}
                          onClick={() => {
                            // Switch to manual entry mode
                            setIsManualEntryMode(true);
                          }}
                          styles={{
                            root: {
                              backgroundColor: 'white',
                              borderColor: 'gray',
                              color: 'black',
                              fontSize: '12px',
                              '&:hover': {
                                backgroundColor: 'var(--mantine-color-gray-0)'
                              }
                            }
                          }}
                        >
                          Manually enter data
                        </Button>
                      </Stack>
                    </Stack>
                  </Flex>
                )}
              </Box>
            </Card>
        )}
      </Container>

      {/* Action Modal */}
      <Modal
        opened={!!selectedAction}
        onClose={() => setSelectedAction(null)}
        title={selectedAction?.label}
        size="md"
      >
        {selectedAction && (
          <Stack gap="md">
            <Text size="sm">{selectedAction.description}</Text>
          </Stack>
        )}
      </Modal>
    </div>
  );
};

export default CellvioWorkbook;
