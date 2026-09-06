export function Mascot({
  className = "",
  happy = false,
}: {
  className?: string;
  happy?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 250"
      fill="none"
      role="img"
      aria-label="Zaytoun, your friendly olive-bird companion"
    >
      <ellipse cx="123" cy="230" rx="66" ry="10" fill="#204C3920" />
      <path
        d="M105 216l-6 15m6-2-13 3m51-15 6 14m-6-2 14 3"
        stroke="#DB9D48"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M101 52C81 20 100 7 125 37c5-30 29-29 29-15-1 15-16 29-24 35"
        fill="#47714B"
      />
      <path
        d="M61 147C29 135 15 151 29 167c7 8 24 12 39 10M181 136c18-25 39-35 43-22 4 15-13 36-39 51"
        fill="#56824C"
      />
      <path
        d="M45 132c0-55 30-89 76-89s76 37 76 89c0 61-23 89-76 89s-76-28-76-89"
        fill="#819746"
      />
      <path
        d="M50 146c8 49 30 66 71 66 39 0 60-20 69-58-13 25-29 38-68 38-37 0-59-18-72-46"
        fill="#6D863C"
      />
      <ellipse cx="121" cy="163" rx="49" ry="46" fill="#C4CD85" />
      <path
        d="M72 106c0-17 12-29 25-29 16 0 24 13 24 29 0-16 9-29 24-29 14 0 26 12 26 29 0 23-21 41-50 41s-49-18-49-41"
        fill="#F7F3D8"
      />
      {happy ? (
        <>
          <path
            d="M88 108q8-12 17 0M138 108q8-12 17 0"
            stroke="#263D30"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <ellipse cx="99" cy="106" rx="6" ry="9" fill="#263D30" />
          <ellipse cx="144" cy="106" rx="6" ry="9" fill="#263D30" />
          <circle cx="101" cy="103" r="2" fill="white" />
          <circle cx="146" cy="103" r="2" fill="white" />
        </>
      )}
      <ellipse cx="83" cy="124" rx="10" ry="5" fill="#E6A174" opacity=".65" />
      <ellipse cx="160" cy="124" rx="10" ry="5" fill="#E6A174" opacity=".65" />
      <path d="M111 123q10-11 21 0l-10 13z" fill="#DF9D42" />
      <path
        d="M75 158c25 10 66 10 91-1l-5 18c-24 9-56 7-82-2z"
        fill="#F6F2DE"
      />
      <path
        d="m89 164 7 11m10-8 6 11m10-10 5 11m11-12 4 10m-63-8 83 1"
        stroke="#3F6453"
        strokeWidth="3"
      />
      <path d="m157 171 12 24-20 5-6-25" fill="#F6F2DE" />
      <path d="m150 182 14-3m-11 12 14-3" stroke="#3F6453" strokeWidth="3" />
    </svg>
  );
}
export function Landscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 680 260"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="478" cy="58" r="36" fill="#E9CC76" opacity=".75" />
      <path
        d="M0 260v-36C150 89 245 113 365 184c141-131 227-100 315-27v103"
        fill="#D1D6B5"
      />
      <path
        d="M207 159V99h49V72h30v-9a17 17 0 0 1 34 0v9h32v87"
        fill="#EDE4CC"
      />
      <path
        d="M219 119h9v17h-9m12-29h9v17h-9m53-21h9v18h-9m14-18h9v18h-9m16 17h9v18h-9"
        fill="#AEB799"
      />
      <path d="M273 159v-28a12 12 0 0 1 24 0v28" fill="#AEB799" />
      <path
        d="M0 261v-29c111-44 185-48 299-20 152-103 282-83 381-34v83"
        fill="#AFBF98"
      />
      <path
        d="M0 260v-8c143-37 294-12 392-16 108-79 202-63 288-28v52"
        fill="#89A17C"
      />
      <path
        d="M591 221v-82m-1 39-27-21m28 4 26-21m-26 12-16-20"
        stroke="#698064"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <ellipse
        cx="568"
        cy="138"
        rx="16"
        ry="27"
        transform="rotate(-40 568 138)"
        fill="#6D8963"
      />
      <ellipse
        cx="609"
        cy="124"
        rx="15"
        ry="26"
        transform="rotate(36 609 124)"
        fill="#6D8963"
      />
      <ellipse cx="588" cy="114" rx="16" ry="27" fill="#78936D" />
      <path
        d="m41 217 2-46m-1 26-15-16m15 4 14-15"
        stroke="#79916B"
        strokeWidth="4"
      />
      <ellipse
        cx="29"
        cy="172"
        rx="10"
        ry="18"
        transform="rotate(-30 29 172)"
        fill="#91A579"
      />
      <ellipse
        cx="52"
        cy="165"
        rx="10"
        ry="18"
        transform="rotate(30 52 165)"
        fill="#91A579"
      />
    </svg>
  );
}
