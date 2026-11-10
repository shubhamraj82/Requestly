"use client"

import { useState,useEffect } from "react";
import Modal from "@/components/ui/modal"
import {Folder,Search} from "lucide-react"
import { useCollections } from "../hooks/collection";
import { useAddRequestToCollection } from "@/modules/request/hooks/request";
import {toast} from "sonner"
import {REST_METHOD} from "@prisma/client"
import {Button} from "@/components/ui/button"
import {useWorkspaceStore} from "@/modules/layout/store"

