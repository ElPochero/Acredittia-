"use client";
import { useParams } from "next/navigation";
import SubjectDetail from "@/components/platform/SubjectDetail";

export default function DetalleTrabajador() {
  const { id } = useParams<{ id: string }>();
  return <SubjectDetail tipo="personal" id={id} />;
}
