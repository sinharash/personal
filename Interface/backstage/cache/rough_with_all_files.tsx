
details.tsx (Main file - 251 lines)


tsx
import { useState, useEffect } from 'react'
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  ButtonGroup, 
  TextField,
  InputAdornment,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CodeIcon from '@mui/icons-material/Code'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import { useApi } from '@backstage/core-plugin-api'
import { kubernetesApiRef } from '@backstage/plugin-kubernetes'
import { useEntity } from '@backstage/plugin-catalog-react'

import { ElasticacheData } from './types'
import { getAllKeys } from './utils'
import { KeyValueRenderer } from './components'

export function EntityMernaOfferingDetails() {
  const CLUSTER_NAME = 'sf-mrnasvct-test-mecherle'
  const kubernetesApi = useApi(kubernetesApiRef)
  const { entity } = useEntity()

  const resourcePath = entity.metadata.annotations?.['merna.sf/resource-path'] || ''

  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual')
  const [data, setData] = useState<ElasticacheData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!resourcePath) {
        setError('Resource path not found in entity annotations')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await kubernetesApi.proxy({
          clusterName: CLUSTER_NAME,
          path: resourcePath,
        })
        const jsonData = await response.json()
        console.log("API call successful DATA", jsonData)
        setData(jsonData)
        setError(null)
      } catch (err) {
        console.error('An error occurred during API call:', err)
        setError('Failed to fetch Elasticache data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [kubernetesApi, resourcePath])

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const handleExpandAll = () => {
    if (!data) return
    const allKeys = getAllKeys(data)
    setExpandedItems(new Set(allKeys))
  }

  const handleCollapseAll = () => {
    setExpandedItems(new Set())
  }

  const handleCopyAll = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getDataToShow = () => {
    if (!data) return null
    return {
      apiVersion: data.apiVersion,
      kind: data.kind,
      metadata: data.metadata,
      spec: data.spec,
      status: data.status,
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )
    }

    if (error) {
      return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
    }

    const dataToShow = getDataToShow()
    if (!dataToShow) {
      return <Alert severity="info" sx={{ m: 2 }}>No data available</Alert>
    }

    if (viewMode === 'json') {
      return (
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: 'background.default',
            overflow: 'auto',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            m: 0,
            maxHeight: 600,
          }}
        >
          {JSON.stringify(dataToShow, null, 2)}
        </Box>
      )
    }

    return (
      <Box sx={{ maxHeight: 600, overflow: 'auto', pr: 1 }}>
        <KeyValueRenderer
          obj={dataToShow}
          searchTerm={searchTerm}
          expandedItems={expandedItems}
          onToggle={toggleExpand}
        />
      </Box>
    )
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          Details
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Visual view">
              <Button
                onClick={() => setViewMode('visual')}
                variant={viewMode === 'visual' ? 'contained' : 'outlined'}
                startIcon={<VisibilityIcon />}
              >
                Visual
              </Button>
            </Tooltip>
            <Tooltip title="JSON view">
              <Button
                onClick={() => setViewMode('json')}
                variant={viewMode === 'json' ? 'contained' : 'outlined'}
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
              <Button onClick={handleCollapseAll} startIcon={<UnfoldLessIcon />}>
                Collapse All
              </Button>
            </Tooltip>
            <Tooltip title="Copy to clipboard">
              <Button
                onClick={handleCopyAll}
                startIcon={copySuccess ? <CheckCircleIcon /> : <ContentCopyIcon />}
                color={copySuccess ? 'success' : 'primary'}
              >
                {copySuccess ? 'Copied!' : 'Copy All'}
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>

        {viewMode === 'visual' && (
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
  )
}

types/index.ts


ts
export interface ElasticacheData {
  apiVersion: string
  kind: string
  metadata: any
  spec: any
  status: any
}

export interface Condition {
  type: string
  status: string
  reason?: string
  lastTransitionTime: string
  observedGeneration?: number
}

export interface ResourceRef {
  apiVersion: string
  kind: string
  name: string
}

export interface ExpandedItemsContextType {
  expandedItems: Set<string>
  toggleExpand: (key: string) => void
}

utils/index.ts


ts
export * from './helpers'
export * from './icons'

utils/helpers.ts


ts
export const getArrayItemLabel = (item: any, index: number): string => {
  if (item?.type) return item.type
  if (item?.kind && item?.name) return `${item.kind}: ${item.name}`
  if (item?.name) return item.name
  if (item?.manager) return item.manager
  return `Item ${index + 1}`
}

export const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString()
  } catch {
    return timestamp
  }
}

export const isTimestampKey = (key: string): boolean => {
  const timestampKeys = ['creationTimestamp', 'lastTransitionTime', 'time']
  return timestampKeys.includes(key) || key.toLowerCase().includes('timestamp')
}

export const formatKeyForDisplay = (key: string): string => {
  const specialKeys: { [key: string]: string } = {
    'apiVersion': 'API Version',
    'resourceVersion': 'Resource Version',
    'creationTimestamp': 'Created At',
    'lastTransitionTime': 'Last Transition',
    'observedGeneration': 'Observed Generation',
    'compositionRef': 'Composition Reference',
    'compositionRevisionRef': 'Composition Revision',
    'compositionUpdatePolicy': 'Update Policy',
    'resourceRefs': 'Resources',
    'uid': 'UID',
    'us-east-1': 'US East 1',
    'us-west-2': 'US West 2',
  }
  
  if (specialKeys[key]) return specialKeys[key]
  
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

export const renderValue = (value: any, key?: string): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'string') {
    if (key && isTimestampKey(key)) {
      return formatTimestamp(value)
    }
    return value
  }
  if (typeof value === 'number') return value.toString()
  return JSON.stringify(value)
}

export const getAllKeys = (obj: any, prefix = ''): string[] => {
  let keys: string[] = []
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      keys.push(fullKey)
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = [...keys, ...getAllKeys(obj[key], fullKey)]
      }
    })
  }
  return keys
}

export const matchesSearch = (key: string, value: any, searchTerm: string): boolean => {
  if (!searchTerm) return true
  const searchLower = searchTerm.toLowerCase()
  const keyMatch = key.toLowerCase().includes(searchLower)
  const valueMatch = renderValue(value).toLowerCase().includes(searchLower)
  return keyMatch || valueMatch
}

utils/icons.tsx


tsx
import InfoIcon from '@mui/icons-material/Info'
import SettingsIcon from '@mui/icons-material/Settings'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import LabelIcon from '@mui/icons-material/Label'
import StorageIcon from '@mui/icons-material/Storage'
import SecurityIcon from '@mui/icons-material/Security'
import GroupIcon from '@mui/icons-material/Group'
import PersonIcon from '@mui/icons-material/Person'
import CloudIcon from '@mui/icons-material/Cloud'
import LinkIcon from '@mui/icons-material/Link'
import TagIcon from '@mui/icons-material/Tag'
import FolderIcon from '@mui/icons-material/Folder'
import ArticleIcon from '@mui/icons-material/Article'

export const getKeyIcon = (key: string): JSX.Element | null => {
  const iconMap: { [key: string]: JSX.Element } = {
    metadata: <InfoIcon fontSize="small" sx={{ color: 'info.main' }} />,
    spec: <SettingsIcon fontSize="small" sx={{ color: 'warning.main' }} />,
    status: <MonitorHeartIcon fontSize="small" sx={{ color: 'success.main' }} />,
    annotations: <ArticleIcon fontSize="small" sx={{ color: 'secondary.main' }} />,
    labels: <LabelIcon fontSize="small" sx={{ color: 'primary.main' }} />,
    name: <TagIcon fontSize="small" />,
    namespace: <FolderIcon fontSize="small" />,
    crossplane: <CloudIcon fontSize="small" sx={{ color: 'info.main' }} />,
    resourceRefs: <LinkIcon fontSize="small" sx={{ color: 'primary.main' }} />,
    tags: <TagIcon fontSize="small" sx={{ color: 'secondary.main' }} />,
    conditions: <MonitorHeartIcon fontSize="small" sx={{ color: 'success.main' }} />,
    endpoint: <LinkIcon fontSize="small" sx={{ color: 'info.main' }} />,
    SecurityGroup: <SecurityIcon fontSize="small" sx={{ color: 'warning.main' }} />,
    SecurityGroupIngressRule: <SecurityIcon fontSize="small" sx={{ color: 'warning.light' }} />,
    ServerlessCache: <StorageIcon fontSize="small" sx={{ color: 'primary.main' }} />,
    UserGroup: <GroupIcon fontSize="small" sx={{ color: 'info.main' }} />,
    User: <PersonIcon fontSize="small" sx={{ color: 'info.light' }} />,
  }
  return iconMap[key] || null
}

export {
  InfoIcon,
  SettingsIcon,
  MonitorHeartIcon,
  LabelIcon,
  StorageIcon,
  SecurityIcon,
  GroupIcon,
  PersonIcon,
  CloudIcon,
  LinkIcon,
  TagIcon,
  FolderIcon,
  ArticleIcon,
}

components/index.ts


ts
export { ConditionItem } from './ConditionItem'
export { ResourceRefItem } from './ResourceRefItem'
export { ConditionsSection } from './ConditionsSection'
export { ResourceRefsSection } from './ResourceRefsSection'
export { EndpointSection } from './EndpointSection'
export { KeyValueRenderer } from './KeyValueRenderer'

components/ConditionItem.tsx


tsx
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { Condition } from '../types'
import { formatTimestamp, formatKeyForDisplay, renderValue } from '../utils'

interface ConditionItemProps {
  condition: Condition
  path: string
  isExpanded: boolean
  onToggle: (path: string) => void
}

export function ConditionItem({ condition, path, isExpanded, onToggle }: ConditionItemProps) {
  const isHealthy = condition.status === 'True'
  
  return (
    <Box sx={{ mb: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: isHealthy ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.08)',
          borderRadius: 1,
          border: '1px solid',
          borderColor: isHealthy ? 'success.main' : 'error.main',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: isHealthy ? 'rgba(46, 125, 50, 0.15)' : 'rgba(211, 47, 47, 0.15)',
          },
        }}
        onClick={() => onToggle(path)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            color={isHealthy ? 'success' : 'error'}
            variant="filled"
          />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {formatTimestamp(condition.lastTransitionTime)}
        </Typography>
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 4, mt: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
          {Object.entries(condition)
            .filter(([key]) => key !== 'type')
            .map(([key, value]) => (
              <Box key={key} sx={{ mb: 1, display: 'flex', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 150 }}>
                  {formatKeyForDisplay(key)}:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {renderValue(value, key)}
                </Typography>
              </Box>
            ))}
        </Box>
      </Collapse>
    </Box>
  )
}

components/ConditionsSection.tsx


tsx
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import { Condition } from '../types'
import { ConditionItem } from './ConditionItem'

interface ConditionsSectionProps {
  conditions: Condition[]
  basePath: string
  isExpanded: boolean
  expandedItems: Set<string>
  onToggle: (path: string) => void
}

export function ConditionsSection({ 
  conditions, 
  basePath, 
  isExpanded, 
  expandedItems, 
  onToggle 
}: ConditionsSectionProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: 'rgba(46, 125, 50, 0.05)',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'success.main',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.1)' },
        }}
        onClick={() => onToggle(basePath)}
      >
        <IconButton size="small" sx={{ mr: 1 }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <MonitorHeartIcon sx={{ mr: 1, color: 'success.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Health Conditions
        </Typography>
        <Chip label={`${conditions.length} checks`} size="small" sx={{ ml: 2 }} />
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 3, mt: 1 }}>
          {conditions.map((condition, index) => {
            const itemPath = `${basePath}.${index}`
            return (
              <ConditionItem
                key={itemPath}
                condition={condition}
                path={itemPath}
                isExpanded={expandedItems.has(itemPath)}
                onToggle={onToggle}
              />
            )
          })}
        </Box>
      </Collapse>
    </Box>
  )
}

components/ResourceRefItem.tsx


tsx
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { ResourceRef } from '../types'
import { formatKeyForDisplay, renderValue, getKeyIcon } from '../utils'

interface ResourceRefItemProps {
  resource: ResourceRef
  path: string
  isExpanded: boolean
  onToggle: (path: string) => void
}

export function ResourceRefItem({ resource, path, isExpanded, onToggle }: ResourceRefItemProps) {
  const icon = getKeyIcon(resource.kind)
  
  return (
    <Box sx={{ mb: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        onClick={() => onToggle(path)}
      >
        <IconButton size="small" sx={{ p: 0.5, mr: 1 }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
        <Chip label={resource.kind} size="small" variant="outlined" sx={{ mr: 1 }} />
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {resource.name}
        </Typography>
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 4, mt: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
          {Object.entries(resource).map(([key, value]) => (
            <Box key={key} sx={{ mb: 0.5, display: 'flex', gap: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 100 }}>
                {formatKeyForDisplay(key)}:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {renderValue(value, key)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

components/ResourceRefsSection.tsx


tsx
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LinkIcon from '@mui/icons-material/Link'
import { ResourceRef } from '../types'
import { ResourceRefItem } from './ResourceRefItem'

interface ResourceRefsSectionProps {
  resources: ResourceRef[]
  basePath: string
  isExpanded: boolean
  expandedItems: Set<string>
  onToggle: (path: string) => void
}

export function ResourceRefsSection({ 
  resources, 
  basePath, 
  isExpanded, 
  expandedItems, 
  onToggle 
}: ResourceRefsSectionProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: 'rgba(25, 118, 210, 0.05)',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'primary.main',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.1)' },
        }}
        onClick={() => onToggle(basePath)}
      >
        <IconButton size="small" sx={{ mr: 1 }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Managed Resources
        </Typography>
        <Chip label={`${resources.length} resources`} size="small" sx={{ ml: 2 }} />
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 3, mt: 1 }}>
          {resources.map((resource, index) => {
            const itemPath = `${basePath}.${index}`
            return (
              <ResourceRefItem
                key={itemPath}
                resource={resource}
                path={itemPath}
                isExpanded={expandedItems.has(itemPath)}
                onToggle={onToggle}
              />
            )
          })}
        </Box>
      </Collapse>
    </Box>
  )
}

components/EndpointSection.tsx


tsx
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LinkIcon from '@mui/icons-material/Link'
import CloudIcon from '@mui/icons-material/Cloud'
import { formatKeyForDisplay } from '../utils'

interface EndpointSectionProps {
  endpoints: { [region: string]: string }
  basePath: string
  isExpanded: boolean
  onToggle: (path: string) => void
}

export function EndpointSection({ 
  endpoints, 
  basePath, 
  isExpanded, 
  onToggle 
}: EndpointSectionProps) {
  const regionCount = Object.keys(endpoints).length

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: 'rgba(0, 150, 136, 0.05)',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'info.main',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(0, 150, 136, 0.1)' },
        }}
        onClick={() => onToggle(basePath)}
      >
        <IconButton size="small" sx={{ mr: 1 }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <LinkIcon sx={{ mr: 1, color: 'info.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Endpoints
        </Typography>
        <Chip label={`${regionCount} regions`} size="small" sx={{ ml: 2 }} />
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 3, mt: 1 }}>
          {Object.entries(endpoints).map(([region, url]) => (
            <Box
              key={region}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                mb: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CloudIcon sx={{ mr: 1, color: 'info.main' }} />
              <Chip 
                label={formatKeyForDisplay(region)} 
                size="small" 
                variant="outlined" 
                sx={{ mr: 2 }} 
              />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                }}
              >
                {url}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

components/KeyValueRenderer.tsx


tsx
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { 
  formatKeyForDisplay, 
  renderValue, 
  matchesSearch, 
  getArrayItemLabel,
  getKeyIcon 
} from '../utils'
import { ConditionsSection } from './ConditionsSection'
import { ResourceRefsSection } from './ResourceRefsSection'
import { EndpointSection } from './EndpointSection'

interface KeyValueRendererProps {
  obj: any
  path?: string
  depth?: number
  searchTerm: string
  expandedItems: Set<string>
  onToggle: (path: string) => void
}

const getSectionStyle = (key: string, isTopLevel: boolean) => {
  if (!isTopLevel) return {}
  const styles: { [key: string]: any } = {
    metadata: { borderColor: 'info.main', bgcolor: 'rgba(33, 150, 243, 0.05)' },
    spec: { borderColor: 'warning.main', bgcolor: 'rgba(255, 152, 0, 0.05)' },
    status: { borderColor: 'success.main', bgcolor: 'rgba(76, 175, 80, 0.05)' },
  }
  return styles[key] || {}
}

export function KeyValueRenderer({ 
  obj, 
  path = '', 
  depth = 0, 
  searchTerm, 
  expandedItems, 
  onToggle 
}: KeyValueRendererProps) {
  if (!obj || typeof obj !== 'object') return null

  return (
    <>
      {Object.entries(obj)
        .filter(([key, value]) => matchesSearch(key, value, searchTerm))
        .map(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key
          const isExpanded = expandedItems.has(currentPath)
          const isObject = value !== null && typeof value === 'object'
          const isArray = Array.isArray(value)
          const icon = getKeyIcon(key)
          const isTopLevelSection = depth === 0 && ['metadata', 'spec', 'status'].includes(key)

          // Special handling for conditions array
          if (key === 'conditions' && isArray) {
            return (
              <ConditionsSection
                key={currentPath}
                conditions={value}
                basePath={currentPath}
                isExpanded={isExpanded}
                expandedItems={expandedItems}
                onToggle={onToggle}
              />
            )
          }

          // Special handling for resourceRefs array
          if (key === 'resourceRefs' && isArray) {
            return (
              <ResourceRefsSection
                key={currentPath}
                resources={value}
                basePath={currentPath}
                isExpanded={isExpanded}
                expandedItems={expandedItems}
                onToggle={onToggle}
              />
            )
          }

          // Special handling for endpoint object
          if (key === 'endpoint' && isObject && !isArray) {
            return (
              <EndpointSection
                key={currentPath}
                endpoints={value}
                basePath={currentPath}
                isExpanded={isExpanded}
                onToggle={onToggle}
              />
            )
          }

          // Handle arrays with smart labels
          if (isArray) {
            return (
              <Box key={currentPath} sx={{ mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                  onClick={() => onToggle(currentPath)}
                >
                  <IconButton size="small" sx={{ mr: 1 }}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {formatKeyForDisplay(key)}
                  </Typography>
                  <Chip label={`${value.length} items`} size="small" sx={{ ml: 2 }} variant="outlined" />
                </Box>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ ml: 3, mt: 1 }}>
                    {(value as any[]).map((item, index) => {
                      const itemPath = `${currentPath}.${index}`
                      const itemLabel = getArrayItemLabel(item, index)
                      const itemIsObject = typeof item === 'object' && item !== null
                      const itemIsExpanded = expandedItems.has(itemPath)

                      if (!itemIsObject) {
                        return (
                          <Box key={itemPath} sx={{ mb: 0.5, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {renderValue(item)}
                            </Typography>
                          </Box>
                        )
                      }

                      return (
                        <Box key={itemPath} sx={{ mb: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 1.5,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              cursor: 'pointer',
                              '&:hover': { borderColor: 'primary.main' },
                            }}
                            onClick={() => onToggle(itemPath)}
                          >
                            <IconButton size="small" sx={{ p: 0.5, mr: 1 }}>
                              {itemIsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {itemLabel}
                            </Typography>
                          </Box>
                          <Collapse in={itemIsExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ ml: 3, mt: 1 }}>
                              <KeyValueRenderer
                                obj={item}
                                path={itemPath}
                                depth={depth + 1}
                                searchTerm={searchTerm}
                                expandedItems={expandedItems}
                                onToggle={onToggle}
                              />
                            </Box>
                          </Collapse>
                        </Box>
                      )
                    })}
                  </Box>
                </Collapse>
              </Box>
            )
          }

          // Regular object or primitive
          return (
            <Box key={currentPath} sx={{ mb: isTopLevelSection ? 2 : 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: isObject ? 'row' : 'column',
                  alignItems: isObject ? 'center' : 'flex-start',
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: isObject ? 'pointer' : 'default',
                  ...getSectionStyle(key, isTopLevelSection),
                  '&:hover': isObject ? {
                    borderColor: 'primary.main',
                    boxShadow: 1,
                  } : {},
                }}
                onClick={() => isObject && onToggle(currentPath)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: isObject ? 'auto' : '100%' }}>
                  {isObject && (
                    <IconButton size="small" sx={{ mr: 1 }}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                  {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
                  <Typography
                    variant={isTopLevelSection ? 'h6' : 'subtitle2'}
                    sx={{
                      fontWeight: isTopLevelSection ? 700 : 600,
                      color: 'primary.main',
                      textTransform: isTopLevelSection ? 'uppercase' : 'none',
                      letterSpacing: isTopLevelSection ? 1 : 0.5,
                    }}
                  >
                    {formatKeyForDisplay(key)}
                  </Typography>
                  {isObject && !isArray && (
                    <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                      {Object.keys(value).length} properties
                    </Typography>
                  )}
                </Box>
                {!isObject && (
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.primary',
                      wordBreak: 'break-word',
                      mt: 0.5,
                      fontFamily: typeof value === 'string' && (value.includes(':') || value.includes('/')) 
                        ? 'monospace' 
                        : 'inherit',
                      fontSize: typeof value === 'string' && value.length > 50 ? '0.85rem' : 'inherit',
                    }}
                  >
                    {key === 'status' && typeof value === 'string' ? (
                      <Chip
                        icon={value === 'True' ? <CheckCircleIcon /> : <CancelIcon />}
                        label={value}
                        size="small"
                        color={value === 'True' ? 'success' : 'error'}
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
                    <KeyValueRenderer
                      obj={value}
                      path={currentPath}
                      depth={depth + 1}
                      searchTerm={searchTerm}
                      expandedItems={expandedItems}
                      onToggle={onToggle}
                    />
                  </Box>
                </Collapse>
              )}
            </Box>
          )
        })}
    </>
  )
}
```

---

That's all the files! You can copy/paste each one into your project with this folder structure:
```
elasticache-details/
├── details.tsx
├── types/
│   └── index.ts
├── utils/
│   ├── index.ts
│   ├── helpers.ts
│   └── icons.tsx
└── components/
    ├── index.ts
    ├── ConditionItem.tsx
    ├── ConditionsSection.tsx
    ├── ResourceRefItem.tsx
    ├── ResourceRefsSection.tsx
    ├── EndpointSection.tsx
    └── KeyValueRenderer.tsx











