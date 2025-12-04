import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CodeIcon from "@mui/icons-material/Code";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import InfoIcon from "@mui/icons-material/Info";
import SettingsIcon from "@mui/icons-material/Settings";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import LabelIcon from "@mui/icons-material/Label";
import StorageIcon from "@mui/icons-material/Storage";
import SecurityIcon from "@mui/icons-material/Security";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import CloudIcon from "@mui/icons-material/Cloud";
import LinkIcon from "@mui/icons-material/Link";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TagIcon from "@mui/icons-material/Tag";
import FolderIcon from "@mui/icons-material/Folder";
import ArticleIcon from "@mui/icons-material/Article";
import { useApi } from "@backstage/core-plugin-api";
import { kubernetesApiRef } from "@backstage/plugin-kubernetes";
import { useEntity } from "@backstage/plugin-catalog-react";
import { useState, useEffect } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

interface ElasticacheData {
  apiVersion: string;
  kind: string;
  metadata: any;
  spec: any;
  status: any;
}

// Helper to get a friendly label for array items
const getArrayItemLabel = (item: any, index: number): string => {
  // For conditions, use the 'type' field (e.g., "Synced", "Ready")
  if (item?.type) return item.type;
  // For resources, use kind + name (e.g., "SecurityGroup: asdaf2342-us-east-1")
  if (item?.kind && item?.name) return `${item.kind}: ${item.name}`;
  // For resources with just name
  if (item?.name) return item.name;
  // For managed fields, use manager name
  if (item?.manager) return item.manager;
  // Fallback to "Item X"
  return `Item ${index + 1}`;
};

// Get icon for a specific key
const getKeyIcon = (key: string): JSX.Element | null => {
  const iconMap: { [key: string]: JSX.Element } = {
    // Top level sections
    metadata: <InfoIcon fontSize="small" sx={{ color: "info.main" }} />,
    spec: <SettingsIcon fontSize="small" sx={{ color: "warning.main" }} />,
    status: (
      <MonitorHeartIcon fontSize="small" sx={{ color: "success.main" }} />
    ),

    // Metadata fields
    annotations: (
      <ArticleIcon fontSize="small" sx={{ color: "secondary.main" }} />
    ),
    labels: <LabelIcon fontSize="small" sx={{ color: "primary.main" }} />,
    name: <TagIcon fontSize="small" />,
    namespace: <FolderIcon fontSize="small" />,

    // Spec fields
    crossplane: <CloudIcon fontSize="small" sx={{ color: "info.main" }} />,
    resourceRefs: <LinkIcon fontSize="small" sx={{ color: "primary.main" }} />,
    tags: <TagIcon fontSize="small" sx={{ color: "secondary.main" }} />,

    // Status fields
    conditions: (
      <MonitorHeartIcon fontSize="small" sx={{ color: "success.main" }} />
    ),
    endpoint: <LinkIcon fontSize="small" sx={{ color: "info.main" }} />,

    // Resource types
    SecurityGroup: (
      <SecurityIcon fontSize="small" sx={{ color: "warning.main" }} />
    ),
    SecurityGroupIngressRule: (
      <SecurityIcon fontSize="small" sx={{ color: "warning.light" }} />
    ),
    ServerlessCache: (
      <StorageIcon fontSize="small" sx={{ color: "primary.main" }} />
    ),
    UserGroup: <GroupIcon fontSize="small" sx={{ color: "info.main" }} />,
    User: <PersonIcon fontSize="small" sx={{ color: "info.light" }} />,
  };
  return iconMap[key] || null;
};

// Format timestamp to readable format
const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
};

// Check if a key represents a timestamp
const isTimestampKey = (key: string): boolean => {
  const timestampKeys = ["creationTimestamp", "lastTransitionTime", "time"];
  return timestampKeys.includes(key) || key.toLowerCase().includes("timestamp");
};

export function EntityMernaOfferingDetails() {
  const CLUSTER_NAME = "sf-mrnasvct-test-mecherle";
  const kubernetesApi = useApi(kubernetesApiRef);
  const { entity } = useEntity();

  // Get resource path from entity metadata
  const resourcePath =
    entity.metadata.annotations?.["merna.sf/resource-path"] || "";

  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");
  const [data, setData] = useState<ElasticacheData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!resourcePath) {
        setError("Resource path not found in entity annotations");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await kubernetesApi.proxy({
          clusterName: CLUSTER_NAME,
          path: resourcePath,
        });
        const jsonData = await response.json();

        console.log("API call successful DATA", jsonData);
        setData(jsonData);
        setError(null);
      } catch (err) {
        console.error("An error occurred during API call:", err);
        setError("Failed to fetch Elasticache data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [kubernetesApi, resourcePath]);

  const handleExpandAll = () => {
    if (!data) return;
    // Get all keys from the ENTIRE data object, not just status
    const allKeys = getAllKeys(data);
    setExpandedItems(new Set(allKeys));
  };

  const handleCollapseAll = () => {
    setExpandedItems(new Set());
  };

  const handleCopyAll = async () => {
    if (!data) return;
    // Copy the ENTIRE data object, not just status
    const textToCopy = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getAllKeys = (obj: any, prefix = ""): string[] => {
    let keys: string[] = [];
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);
        if (typeof obj[key] === "object" && obj[key] !== null) {
          keys = [...keys, ...getAllKeys(obj[key], fullKey)];
        }
      });
    }
    return keys;
  };

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const renderValue = (value: any, key?: string): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "boolean") return value.toString();
    if (typeof value === "string") {
      // Format timestamps
      if (key && isTimestampKey(key)) {
        return formatTimestamp(value);
      }
      return value;
    }
    if (typeof value === "number") return value.toString();
    return JSON.stringify(value);
  };

  const matchesSearch = (key: string, value: any): boolean => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const keyMatch = key.toLowerCase().includes(searchLower);
    const valueMatch = renderValue(value).toLowerCase().includes(searchLower);
    return keyMatch || valueMatch;
  };

  // Format key for display (add spaces before capitals, handle special cases)
  const formatKeyForDisplay = (key: string): string => {
    // Special case mappings
    const specialKeys: { [key: string]: string } = {
      apiVersion: "API Version",
      resourceVersion: "Resource Version",
      creationTimestamp: "Created At",
      lastTransitionTime: "Last Transition",
      observedGeneration: "Observed Generation",
      compositionRef: "Composition Reference",
      compositionRevisionRef: "Composition Revision",
      compositionUpdatePolicy: "Update Policy",
      resourceRefs: "Resources",
      uid: "UID",
      "us-east-1": "US East 1",
      "us-west-2": "US West 2",
    };

    if (specialKeys[key]) return specialKeys[key];

    // Add spaces before capitals and capitalize first letter
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Render a condition item specially
  const renderConditionItem = (condition: any, path: string): JSX.Element => {
    const isExpanded = expandedItems.has(path);
    const isHealthy = condition.status === "True";

    return (
      <Box key={path} sx={{ mb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            bgcolor: isHealthy
              ? "rgba(46, 125, 50, 0.08)"
              : "rgba(211, 47, 47, 0.08)",
            borderRadius: 1,
            border: "1px solid",
            borderColor: isHealthy ? "success.main" : "error.main",
            cursor: "pointer",
            "&:hover": {
              bgcolor: isHealthy
                ? "rgba(46, 125, 50, 0.15)"
                : "rgba(211, 47, 47, 0.15)",
            },
          }}
          onClick={() => toggleExpand(path)}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton size="small" sx={{ p: 0.5 }}>
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            {isHealthy ? (
              <CheckCircleIcon color="success" />
            ) : (
              <CancelIcon color="error" />
            )}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {condition.type}
            </Typography>
            <Chip
              label={condition.reason || condition.status}
              size="small"
              color={isHealthy ? "success" : "error"}
              variant="filled"
            />
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {formatTimestamp(condition.lastTransitionTime)}
          </Typography>
        </Box>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box
            sx={{
              ml: 4,
              mt: 1,
              pl: 2,
              borderLeft: "2px solid",
              borderColor: "divider",
            }}
          >
            {Object.entries(condition)
              .filter(([key]) => key !== "type") // Don't show type again
              .map(([key, value]) => (
                <Box key={key} sx={{ mb: 1, display: "flex", gap: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", minWidth: 150 }}
                  >
                    {formatKeyForDisplay(key)}:
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {renderValue(value, key)}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Collapse>
      </Box>
    );
  };

  // Render a resource reference item (from resourceRefs array)
  const renderResourceRefItem = (resource: any, path: string): JSX.Element => {
    const isExpanded = expandedItems.has(path);
    const icon = getKeyIcon(resource.kind);

    return (
      <Box key={path} sx={{ mb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 1.5,
            bgcolor: "background.paper",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            cursor: "pointer",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: "action.hover",
            },
          }}
          onClick={() => toggleExpand(path)}
        >
          <IconButton size="small" sx={{ p: 0.5, mr: 1 }}>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
          <Chip
            label={resource.kind}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {resource.name}
          </Typography>
        </Box>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box
            sx={{
              ml: 4,
              mt: 1,
              pl: 2,
              borderLeft: "2px solid",
              borderColor: "divider",
            }}
          >
            {Object.entries(resource).map(([key, value]) => (
              <Box key={key} sx={{ mb: 0.5, display: "flex", gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", minWidth: 100 }}
                >
                  {formatKeyForDisplay(key)}:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  {renderValue(value, key)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Box>
    );
  };

  const renderKeyValue = (obj: any, path = "", depth = 0): JSX.Element[] => {
    if (!obj || typeof obj !== "object") return [];

    return Object.entries(obj)
      .filter(([key, value]) => matchesSearch(key, value))
      .map(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        const isExpanded = expandedItems.has(currentPath);
        const isObject = value !== null && typeof value === "object";
        const isArray = Array.isArray(value);
        const icon = getKeyIcon(key);

        // Special handling for conditions array
        if (key === "conditions" && isArray) {
          return (
            <Box key={currentPath} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 2,
                  bgcolor:
                    depth === 0
                      ? "rgba(46, 125, 50, 0.05)"
                      : "background.paper",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "success.main",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "rgba(46, 125, 50, 0.1)" },
                }}
                onClick={() => toggleExpand(currentPath)}
              >
                <IconButton size="small" sx={{ mr: 1 }}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <MonitorHeartIcon sx={{ mr: 1, color: "success.main" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Health Conditions
                </Typography>
                <Chip
                  label={`${value.length} checks`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ ml: 3, mt: 1 }}>
                  {(value as any[]).map((item, index) =>
                    renderConditionItem(item, `${currentPath}.${index}`)
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        }

        // Special handling for resourceRefs array
        if (key === "resourceRefs" && isArray) {
          return (
            <Box key={currentPath} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 2,
                  bgcolor: "rgba(25, 118, 210, 0.05)",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "primary.main",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "rgba(25, 118, 210, 0.1)" },
                }}
                onClick={() => toggleExpand(currentPath)}
              >
                <IconButton size="small" sx={{ mr: 1 }}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <LinkIcon sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Managed Resources
                </Typography>
                <Chip
                  label={`${value.length} resources`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ ml: 3, mt: 1 }}>
                  {(value as any[]).map((item, index) =>
                    renderResourceRefItem(item, `${currentPath}.${index}`)
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        }

        // Special handling for endpoint object
        if (key === "endpoint" && isObject && !isArray) {
          return (
            <Box key={currentPath} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 2,
                  bgcolor: "rgba(0, 150, 136, 0.05)",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "info.main",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "rgba(0, 150, 136, 0.1)" },
                }}
                onClick={() => toggleExpand(currentPath)}
              >
                <IconButton size="small" sx={{ mr: 1 }}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <LinkIcon sx={{ mr: 1, color: "info.main" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Endpoints
                </Typography>
                <Chip
                  label={`${Object.keys(value).length} regions`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ ml: 3, mt: 1 }}>
                  {Object.entries(value as object).map(([region, url]) => (
                    <Box
                      key={region}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        p: 1.5,
                        mb: 1,
                        bgcolor: "background.paper",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <CloudIcon sx={{ mr: 1, color: "info.main" }} />
                      <Chip
                        label={formatKeyForDisplay(region)}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 2 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          wordBreak: "break-all",
                        }}
                      >
                        {url as string}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        }

        // Top-level sections (metadata, spec, status)
        const isTopLevelSection =
          depth === 0 && ["metadata", "spec", "status"].includes(key);

        // Section colors
        const getSectionStyle = () => {
          if (!isTopLevelSection) return {};
          const styles: { [key: string]: any } = {
            metadata: {
              borderColor: "info.main",
              bgcolor: "rgba(33, 150, 243, 0.05)",
            },
            spec: {
              borderColor: "warning.main",
              bgcolor: "rgba(255, 152, 0, 0.05)",
            },
            status: {
              borderColor: "success.main",
              bgcolor: "rgba(76, 175, 80, 0.05)",
            },
          };
          return styles[key] || {};
        };

        // Handle arrays with smart labels
        if (isArray) {
          return (
            <Box key={currentPath} sx={{ mb: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 2,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  cursor: "pointer",
                  "&:hover": { borderColor: "primary.main" },
                }}
                onClick={() => toggleExpand(currentPath)}
              >
                <IconButton size="small" sx={{ mr: 1 }}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "primary.main" }}
                >
                  {formatKeyForDisplay(key)}
                </Typography>
                <Chip
                  label={`${value.length} items`}
                  size="small"
                  sx={{ ml: 2 }}
                  variant="outlined"
                />
              </Box>
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ ml: 3, mt: 1 }}>
                  {(value as any[]).map((item, index) => {
                    const itemPath = `${currentPath}.${index}`;
                    const itemLabel = getArrayItemLabel(item, index);
                    const itemIsObject =
                      typeof item === "object" && item !== null;
                    const itemIsExpanded = expandedItems.has(itemPath);

                    if (!itemIsObject) {
                      return (
                        <Box
                          key={itemPath}
                          sx={{
                            mb: 0.5,
                            p: 1,
                            bgcolor: "background.paper",
                            borderRadius: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace" }}
                          >
                            {renderValue(item)}
                          </Typography>
                        </Box>
                      );
                    }

                    return (
                      <Box key={itemPath} sx={{ mb: 1 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            p: 1.5,
                            bgcolor: "background.paper",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            cursor: "pointer",
                            "&:hover": { borderColor: "primary.main" },
                          }}
                          onClick={() => toggleExpand(itemPath)}
                        >
                          <IconButton size="small" sx={{ p: 0.5, mr: 1 }}>
                            {itemIsExpanded ? (
                              <ExpandLessIcon />
                            ) : (
                              <ExpandMoreIcon />
                            )}
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {itemLabel}
                          </Typography>
                        </Box>
                        <Collapse
                          in={itemIsExpanded}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ ml: 3, mt: 1 }}>
                            {renderKeyValue(item, itemPath, depth + 1)}
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        }

        // Regular object or primitive
        return (
          <Box key={currentPath} sx={{ mb: isTopLevelSection ? 2 : 1 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: isObject ? "row" : "column",
                alignItems: isObject ? "center" : "flex-start",
                p: 2,
                bgcolor: "background.paper",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                cursor: isObject ? "pointer" : "default",
                ...getSectionStyle(),
                "&:hover": isObject
                  ? {
                      borderColor: "primary.main",
                      boxShadow: 1,
                    }
                  : {},
              }}
              onClick={() => isObject && toggleExpand(currentPath)}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  width: isObject ? "auto" : "100%",
                }}
              >
                {isObject && (
                  <IconButton size="small" sx={{ mr: 1 }}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                )}
                {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
                <Typography
                  variant={isTopLevelSection ? "h6" : "subtitle2"}
                  sx={{
                    fontWeight: isTopLevelSection ? 700 : 600,
                    color: "primary.main",
                    textTransform: isTopLevelSection ? "uppercase" : "none",
                    letterSpacing: isTopLevelSection ? 1 : 0.5,
                  }}
                >
                  {formatKeyForDisplay(key)}
                </Typography>
                {isObject && !isArray && (
                  <Typography
                    variant="caption"
                    sx={{ ml: 2, color: "text.secondary" }}
                  >
                    {Object.keys(value).length} properties
                  </Typography>
                )}
              </Box>
              {!isObject && (
                <Typography
                  variant="body1"
                  sx={{
                    color: "text.primary",
                    wordBreak: "break-word",
                    mt: 0.5,
                    fontFamily:
                      typeof value === "string" &&
                      (value.includes(":") || value.includes("/"))
                        ? "monospace"
                        : "inherit",
                    fontSize:
                      typeof value === "string" && value.length > 50
                        ? "0.85rem"
                        : "inherit",
                  }}
                >
                  {key === "status" && typeof value === "string" ? (
                    <Chip
                      icon={
                        value === "True" ? <CheckCircleIcon /> : <CancelIcon />
                      }
                      label={value}
                      size="small"
                      color={value === "True" ? "success" : "error"}
                    />
                  ) : (
                    renderValue(value, key)
                  )}
                </Typography>
              )}
            </Box>
            {isObject && (
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ ml: isTopLevelSection ? 2 : 3, mt: 1 }}>
                  {renderKeyValue(value, currentPath, depth + 1)}
                </Box>
              </Collapse>
            )}
          </Box>
        );
      });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      );
    }

    if (!data) {
      return (
        <Alert severity="info" sx={{ m: 2 }}>
          No data available
        </Alert>
      );
    }

    // Show ALL data: apiVersion, kind, metadata, spec, and status
    const dataToShow = {
      apiVersion: data.apiVersion,
      kind: data.kind,
      metadata: data.metadata,
      spec: data.spec,
      status: data.status,
    };

    if (viewMode === "json") {
      return (
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: "background.default",
            overflow: "auto",
            fontSize: "0.875rem",
            fontFamily: "monospace",
            m: 0,
            maxHeight: 600,
          }}
        >
          {JSON.stringify(dataToShow, null, 2)}
        </Box>
      );
    }

    return (
      <Box sx={{ maxHeight: 600, overflow: "auto", pr: 1 }}>
        {renderKeyValue(dataToShow)}
      </Box>
    );
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Details
        </Typography>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mb: 2,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Visual view">
              <Button
                onClick={() => setViewMode("visual")}
                variant={viewMode === "visual" ? "contained" : "outlined"}
                startIcon={<VisibilityIcon />}
              >
                Visual
              </Button>
            </Tooltip>
            <Tooltip title="JSON view">
              <Button
                onClick={() => setViewMode("json")}
                variant={viewMode === "json" ? "contained" : "outlined"}
                startIcon={<CodeIcon />}
              >
                JSON
              </Button>
            </Tooltip>
          </ButtonGroup>
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Expand all items">
              <Button onClick={handleExpandAll} startIcon={<UnfoldMoreIcon />}>
                Expand All
              </Button>
            </Tooltip>
            <Tooltip title="Collapse all items">
              <Button
                onClick={handleCollapseAll}
                startIcon={<UnfoldLessIcon />}
              >
                Collapse All
              </Button>
            </Tooltip>
            <Tooltip title="Copy to clipboard">
              <Button
                onClick={handleCopyAll}
                startIcon={
                  copySuccess ? <CheckCircleIcon /> : <ContentCopyIcon />
                }
                color={copySuccess ? "success" : "primary"}
              >
                {copySuccess ? "Copied!" : "Copy All"}
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>
        {viewMode === "visual" && (
          <TextField
            fullWidth
            size="small"
            placeholder="Search outputs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
        )}
        {renderContent()}
      </CardContent>
    </Card>
  );
}
