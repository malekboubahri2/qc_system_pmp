#ifndef DEFECTS_PMPVIEW_HPP
#define DEFECTS_PMPVIEW_HPP

#include <gui_generated/defects_pmp_screen/defects_pmpViewBase.hpp>
#include <gui/defects_pmp_screen/defects_pmpPresenter.hpp>
#include <touchgfx/Callback.hpp>
#include <touchgfx/events/ClickEvent.hpp>
#include <touchgfx/containers/buttons/BoxWithBorderButtonStyle.hpp>
#include <touchgfx/containers/buttons/ClickButtonTrigger.hpp>
#include <touchgfx/containers/buttons/TextButtonStyle.hpp>
#include <touchgfx/mixins/ClickListener.hpp>

class defects_pmpView : public defects_pmpViewBase
{
public:
    defects_pmpView();
    virtual ~defects_pmpView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();

private:
    typedef touchgfx::ClickListener<
        touchgfx::TextButtonStyle<
            touchgfx::BoxWithBorderButtonStyle<
                touchgfx::ClickButtonTrigger>>> DefectButton;

    /* 7 numbered defects + Autre = 8 slots. PMP buttons are defect_4..defect_10 + defect_other. */
    static constexpr int DEFECT_COUNT = 8;

    bool m_selected[DEFECT_COUNT]; /* index 0..6 = defect_4..defect_10, index 7 = defect_other */
    bool m_autre_selected;

    void updateDefectButton(DefectButton& btn, bool selected);
    void updateActionButton();

    void onDefectClicked(const DefectButton& src, const touchgfx::ClickEvent& evt);
    void onNextClicked(const DefectButton& src, const touchgfx::ClickEvent& evt);

    touchgfx::Callback<defects_pmpView, const DefectButton&, const touchgfx::ClickEvent&> m_defectCb;
    touchgfx::Callback<defects_pmpView, const DefectButton&, const touchgfx::ClickEvent&> m_nextCb;
};

#endif // DEFECTS_PMPVIEW_HPP
