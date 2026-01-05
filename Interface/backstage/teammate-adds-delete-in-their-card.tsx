import { useState } from 'react'
import { useDeprovisionResource } from '../../hooks/use-deprovision-resource'
import { DeprovisionModal } from '../deprovision-merna-offering/deprovision-modal'
import { 
  getCapabilityDeletionDescription, 
  getDeleteStatusInfo,
  canUserDelete 
} from '../../utils/deprovision-utils'

function TheirCard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // 1. Get data
  const {
    name, resourceTag, handleDeprovision, 
    isDeleting, canDeprovision, isOwner
  } = useDeprovisionResource()

  // 2. Use utils
  const canDelete = canUserDelete(isOwner, canDeprovision)
  const statusInfo = getDeleteStatusInfo(isOwner, canDeprovision)
  const additionalDescription = getCapabilityDeletionDescription(resourceTag)

  // 3. Handlers
  const openModal = () => canDelete && setIsModalOpen(true)
  const closeModal = () => !isDeleting && setIsModalOpen(false)
  const confirmDelete = async () => {
    await handleDeprovision()
    setIsModalOpen(false)
  }

  return (
    <>
      {/* Their card with delete button */}
      <DeprovisionModal
        name={name}
        resourceTag={resourceTag}
        open={isModalOpen}
        onClose={closeModal}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        additionalDescription={additionalDescription}
      />
    </>
  )
}
```

**Important:** Their card must be inside `ResourcePageWrapper` (which is already in EntityPage).

---

## Final File Structure
```
v2/
├── components/
│   └── deprovision-merna-offering/
│       ├── delete-card.tsx           # Your card (no changes to logic)
│       ├── deprovision-modal.tsx     # Modal (no changes)
│       └── resource-page-wrapper.tsx # Wrapper (no changes)
│
├── hooks/
│   ├── resource-provider.tsx         # Context (no changes)
│   └── use-deprovision-resource.ts   # Hook (no changes)
│
└── utils/
    └── deprovision-utils.ts          # NEW: Extracted utility functions