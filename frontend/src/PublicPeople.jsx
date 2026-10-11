import React from "react";
import { useLocale } from "./localization-runtime";
import {
  companyPeopleInPublicRecord,
  companyPeopleSource,
} from "./companyPeople";

export function PublicPeople() {
  const persian = useLocale() === "fa";
  return (
    <div className="container page record-people-page">
      <span className="eyebrow">
        {persian ? "اطلاعات ثبتی شرکت" : "COMPANY RECORD"}
      </span>
      <h1>{persian ? "افراد و سمت‌ها" : "People and positions"}</h1>
      <p className="page-lead">
        {persian
          ? "افراد و سمت‌های درج‌شده در آگهی ثبتی منتشرشده در ۱۸ آوریل ۲۰۲۶."
          : "People and positions listed in the registration notice published on 18 April 2026."}
      </p>
      <div className="record-people-grid">
        {companyPeopleInPublicRecord.map((person) => (
          <article className="record-person" key={person.nameFa}>
            <span className="record-person-mark" aria-hidden="true">{person.nameFa[0]}</span>
            <div>
              <h2 lang="fa" dir="rtl" data-no-translate>{person.nameFa}</h2>
              <p>{persian ? person.roleFa : person.roleEn}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="record-source">
        {persian ? "منبع: " : "Source: "}
        <a href={companyPeopleSource} target="_blank" rel="noopener noreferrer">
          {persian ? "آگهی ثبتی شرکت در لینکا" : "Company registration notice on Linka"}
        </a>
      </p>
    </div>
  );
}
